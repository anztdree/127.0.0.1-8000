'use strict';

var RH = require('../../shared/responseHelper');
var logger = require('../../shared/utils/logger');

/**
 * Task Handler
 *
 * Client protocol — type: "task"
 *   queryTask  (READ)  — params: userId, taskClass (DAILY/ACHIEVEMENT/MAIN), version
 *                         response: { _tasks: [] }
 *   getReward  (WRITE) — params: userId, taskClass (DAILY/ACHIEVEMENT/MAIN), taskIds (array), version
 *                         response: { _changeInfo: { _items: {...} }, _nextTask: {}, _nextTasks: [], _finishTasks: [] }
 */

function handle(socket, parsed, callback) {
    var action = parsed.action;
    var userId = parsed.userId;

    switch (action) {

        // ── queryTask (READ) ────────────────────────────────────────
        // Returns the task list for a given task class.
        // Client expects: { _tasks: [] }
        case 'queryTask': {
            var taskClass = parsed.taskClass;   // DAILY | ACHIEVEMENT | MAIN
            var version   = parsed.version;

            logger.info('TASK', 'queryTask userId=' + (userId || '-')
                + ' taskClass=' + (taskClass || '-')
                + ' version=' + (version || '-'));

            // TODO: Load task data for userId + taskClass, validate version
            callback(RH.success({
                _tasks: []
            }));
            break;
        }

        // ── getReward (WRITE) ───────────────────────────────────────
        // Claim rewards for completed tasks.
        // Client expects: { _changeInfo, _nextTask, _nextTasks, _finishTasks }
        case 'getReward': {
            var taskClass = parsed.taskClass;   // DAILY | ACHIEVEMENT | MAIN
            var taskIds   = parsed.taskIds;     // array of task IDs
            var version   = parsed.version;

            logger.info('TASK', 'getReward userId=' + (userId || '-')
                + ' taskClass=' + (taskClass || '-')
                + ' taskIds=' + JSON.stringify(taskIds || [])
                + ' version=' + (version || '-'));

            // TODO: Validate version, verify tasks are completed, grant rewards
            callback(RH.success({
                _changeInfo: {
                    _items: {}
                },
                _nextTask: {},
                _nextTasks: [],
                _finishTasks: []
            }));
            break;
        }

        // ── Unknown action ──────────────────────────────────────────
        default:
            logger.warn('TASK', 'Unknown action: ' + action + ' userId=' + (userId || '-'));
            callback(RH.success({}));
            break;
    }
}

module.exports = { handle: handle };
