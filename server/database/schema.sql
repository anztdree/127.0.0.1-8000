-- ============================================
-- Super Warrior Z — Database Schema
--
-- REFERENCE FILE
-- Tables are created automatically by database/connection.js init().
-- This file can also be run manually for fresh setup:
--   mariadb -u admin -p < schema.sql
--
-- Schema version: 1 (tracked in _schema_meta table)
--
-- DESIGN: user_data uses a single game_data JSON column
-- to store ALL 88+ fields from UserDataParser.saveUserData().
-- This eliminates column mismatch issues and requires
-- zero schema migration when adding new game fields.
--
-- Tables:
--   1. users          — Account data (login, registration)
--   2. user_data      — Per-server game state (JSON blob)
--   3. user_online    — Online user tracking (duplicate login detection)
--   4. login_tokens   — Session token storage (login -> enterGame flow)
--   5. _schema_meta   — Schema version tracking (server-side)
--
-- Sources:
--   UserDataParser.saveUserData() (line 77641-77724)
--   loginGame request (line 77300-77315)
--   errorDefine.json (365 error codes)
-- ============================================

CREATE DATABASE IF NOT EXISTS `super_warrior_z`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_unicode_ci;

USE `super_warrior_z`;


-- ============================================
-- 1. users table
--
-- Source: UserDataParser e.user (line 77670-77673):
--   { _id, _pwd, _nickName, _headImage, _lastLoginTime,
--     _createTime, _bulletinVersions, _oriServerId, _nickChangeTimes }
--
-- Source: loginGame request (line 77300-77315):
--   { type:"User", action:"loginGame", userId, password,
--     fromChannel, channelName, headImageUrl, nickName, subChannel, version }
--
-- PASSWORD: PLAINTEXT (line 88576-88584)
--   Client reads passwordInput.text directly, NO hashing
--   Default: "game_origin" (line 88641)
--
-- AUTO-REGISTER: YES
--   Client has NO register action. Only loginGame.
--   If userId not found, server auto-creates account.
--   newUser flag checked in loginSuccessCallBack (line 77433)
-- ============================================

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL UNIQUE COMMENT 'userId — unique login identifier',
    `password` VARCHAR(128) NOT NULL DEFAULT 'game_origin' COMMENT 'PLAINTEXT password — client sends raw, no hash',
    `nick_name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '_nickName from UserDataParser',
    `head_image` VARCHAR(256) NOT NULL DEFAULT '' COMMENT '_headImage from UserDataParser',
    `from_channel` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'fromChannel from loginGame request',
    `channel_name` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'channelName from loginGame request',
    `sub_channel` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'subChannel from loginGame request',
    `ori_server_id` INT NOT NULL DEFAULT 0 COMMENT '_oriServerId from UserDataParser',
    `nick_change_times` INT NOT NULL DEFAULT 0 COMMENT '_nickChangeTimes from UserDataParser',
    `last_login_time` BIGINT NOT NULL DEFAULT 0 COMMENT '_lastLoginTime from UserDataParser',
    `create_time` BIGINT NOT NULL DEFAULT 0 COMMENT '_createTime from UserDataParser',
    `bulletin_versions` TEXT DEFAULT NULL COMMENT '_bulletinVersions from UserDataParser',
    `is_new` TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'newUser flag — loginSuccessCallBack checks e.newUser (line 77433)',
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- 2. user_data table
--
-- Stores per-server user game state as a single JSON blob.
-- ALL 88+ fields from UserDataParser.saveUserData() (line 77641-77724)
-- are stored in the game_data JSON column.
--
-- Why JSON column instead of separate columns:
--   - Client has 88+ fields, many are complex nested objects
--   - Adding new fields requires NO schema migration
--   - Eliminates column mismatch bugs entirely
--   - MariaDB JSON type supports efficient storage
--   - Game data is always loaded/saved as a complete unit
-- ============================================

CREATE TABLE IF NOT EXISTS `user_data` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL COMMENT 'userId from enterGame request',
    `server_id` INT NOT NULL DEFAULT 1 COMMENT 'serverId from enterGame request',
    `game_data` JSON DEFAULT NULL COMMENT 'ALL 88+ fields from UserDataParser.saveUserData() as JSON blob',
    `last_login_time` BIGINT NOT NULL DEFAULT 0 COMMENT '_lastLoginTime',
    `update_time` BIGINT NOT NULL DEFAULT 0 COMMENT 'Last data update timestamp',
    UNIQUE KEY `uk_user_server` (`user_id`, `server_id`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- 3. user_online table
--
-- Tracks online users per server.
-- Used to detect duplicate login (error code 12).
-- errorDefine.json code 12: ERROR_USER_LOGIN_BEFORE
-- ============================================

CREATE TABLE IF NOT EXISTS `user_online` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL,
    `server_id` INT NOT NULL DEFAULT 1,
    `socket_id` VARCHAR(128) NOT NULL DEFAULT '',
    `login_time` BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY `uk_user_server` (`user_id`, `server_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- 4. login_tokens table
--
-- Stores active login tokens for session validation.
-- loginToken is generated on loginGame (login server)
-- and validated on enterGame (main server).
--
-- Client: ts.loginInfo.userInfo.loginToken (line 88719)
-- enterGame request: { type:"user", action:"enterGame", loginToken, userId, serverId, ... }
-- ============================================

CREATE TABLE IF NOT EXISTS `login_tokens` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` VARCHAR(64) NOT NULL,
    `token` VARCHAR(256) NOT NULL,
    `server_id` INT NOT NULL DEFAULT 1,
    `created_at` BIGINT NOT NULL DEFAULT 0,
    `expires_at` BIGINT NOT NULL DEFAULT 0,
    `used` TINYINT(1) NOT NULL DEFAULT 0,
    INDEX `idx_token` (`token`),
    INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- 5. _schema_meta table (server-side)
--
-- Tracks schema version for migration awareness.
-- Not derived from client code — server-side enhancement.
-- Used by connection.js init() to record the current schema version.
-- ============================================

CREATE TABLE IF NOT EXISTS `_schema_meta` (
    `key_name` VARCHAR(64) NOT NULL PRIMARY KEY,
    `key_value` VARCHAR(256) NOT NULL,
    `updated_at` BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================
-- Initialize schema metadata (idempotent)
-- ============================================

INSERT INTO `_schema_meta` (`key_name`, `key_value`, `updated_at`)
VALUES ('schema_version', '1', UNIX_TIMESTAMP() * 1000)
ON DUPLICATE KEY UPDATE `key_value` = '1', `updated_at` = UNIX_TIMESTAMP() * 1000;
