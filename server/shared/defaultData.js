/**
 * Default Data Generator for New Users
 *
 * 100% derived from client code analysis and resource/json config files.
 *
 * Sources:
 * - resource/json/constant.json -> initial values
 * - resource/json/summonEnergy.json -> initial summon energy
 * - UserDataParser.saveUserData() (line 77643-77724) -> field structure
 * - HeroAttribute defaults (line 84951-84961) -> attribute structure
 * - Serializable base class (line 51891-51894) -> _prefix stripping
 *
 * Every field in this file is derived from client code analysis.
 * The client reads these fields in UserDataParser.saveUserData(e)
 * where `e` is the parsed JSON from the enterGame response.
 */

const GameData = require('./gameData/loader');

const GAME_CONSTANTS = {
    // From resource/json/constant.json[1]
    startUserLevel: 1,
    maxUserLevel: 300,
    startUserExp: 0,
    startDiamond: 0,
    startGold: 0,
    startHero: '1205',          // Starting hero displayId
    startHeroLevel: '3',        // Starting hero level
    startChapter: 801,          // Starting chapter
    startLesson: 10101,         // Starting lesson
    playerIcon: 'hero_icon_1205',
    idle: 28800,                // Max idle time (8h in seconds)
    changeNameNeeded: '200',    // Diamonds needed to change name
    playerNameLength: 12,
    resetTime: '6:00:00',      // Daily reset at 6 AM
};

// Item IDs from client (hardcoded in item configs)
const ITEM_IDS = {
    DIAMONDID: 101,
    GOLDID: 102,
    PLAYEREXPERIENCEID: 103,
    PLAYERLEVELID: 104,
    PLAYERVIPEXPERIENCEID: 105,
    PLAYERVIPLEVELID: 106,
    PLAYERVIPEXPALLID: 107,
    SoulCoinID: 111,
    ArenaCoinID: 112,
    SnakeCoinID: 113,
    TeamCoinID: 114,
    HonourCoinID: 115,
    EXPERIENCECAPSULEID: 131,
    EVOLVECAPSULEID: 132,
    EnergyStone: 136,
};

/**
 * Generate default totalProps (inventory) for new user
 *
 * Client: setBackpack(e) reads e.totalProps._items as {[itemId]: {_id, _num}}
 * From constant.json: startDiamond=0, startGold=0, startUserLevel=1
 *
 * BUG FIX: thingsID.json has a `startNum` field per item that defines the starting
 * quantity for new players. The old code hardcoded all items to 0 (from constant.json),
 * ignoring thingsID.json entirely. This caused the tutorial to break at step 2301 (Upgrade)
 * because players had 0 Exp Capsules and 0 Gold when the tutorial expects them to upgrade.
 *
 * thingsID.json startNum values:
 *   Gold (102)         -> startNum: 10000
 *   Exp Capsule (131)  -> startNum: 1000
 *   God Water (134)    -> startNum: 50
 *
 * Now reads startNum from thingsID.json at runtime (GameData is loaded before
 * generateNewUserData is called from enterGame handler).
 */
function generateDefaultTotalProps() {
    var thingsID = GameData.get('thingsID');
    var startNumMap = {};
    if (thingsID) {
        for (var key in thingsID) {
            var item = thingsID[key];
            if (item && item.id != null && item.startNum != null) {
                startNumMap[item.id] = item.startNum;
            }
        }
    }

    return {
        _items: {
            [ITEM_IDS.DIAMONDID]: { _id: ITEM_IDS.DIAMONDID, _num: startNumMap[101] || GAME_CONSTANTS.startDiamond },
            [ITEM_IDS.GOLDID]: { _id: ITEM_IDS.GOLDID, _num: startNumMap[102] || GAME_CONSTANTS.startGold },
            [ITEM_IDS.PLAYEREXPERIENCEID]: { _id: ITEM_IDS.PLAYEREXPERIENCEID, _num: GAME_CONSTANTS.startUserExp },
            [ITEM_IDS.PLAYERLEVELID]: { _id: ITEM_IDS.PLAYERLEVELID, _num: GAME_CONSTANTS.startUserLevel },
            [ITEM_IDS.PLAYERVIPEXPERIENCEID]: { _id: ITEM_IDS.PLAYERVIPEXPERIENCEID, _num: 0 },
            [ITEM_IDS.PLAYERVIPLEVELID]: { _id: ITEM_IDS.PLAYERVIPLEVELID, _num: 0 },
            [ITEM_IDS.PLAYERVIPEXPALLID]: { _id: ITEM_IDS.PLAYERVIPEXPALLID, _num: 0 },
            [ITEM_IDS.SoulCoinID]: { _id: ITEM_IDS.SoulCoinID, _num: 0 },
            [ITEM_IDS.ArenaCoinID]: { _id: ITEM_IDS.ArenaCoinID, _num: 0 },
            [ITEM_IDS.SnakeCoinID]: { _id: ITEM_IDS.SnakeCoinID, _num: 0 },
            [ITEM_IDS.TeamCoinID]: { _id: ITEM_IDS.TeamCoinID, _num: 0 },
            [ITEM_IDS.HonourCoinID]: { _id: ITEM_IDS.HonourCoinID, _num: 0 },
            [ITEM_IDS.EXPERIENCECAPSULEID]: { _id: ITEM_IDS.EXPERIENCECAPSULEID, _num: startNumMap[131] || 0 },
            [ITEM_IDS.EVOLVECAPSULEID]: { _id: ITEM_IDS.EVOLVECAPSULEID, _num: startNumMap[132] || 0 },
            [ITEM_IDS.EnergyStone]: { _id: ITEM_IDS.EnergyStone, _num: startNumMap[136] || 0 },
        },
    };
}

/**
 * Generate default hero data for new user
 *
 * Client: HerosManager.readByData(e.heros) reads e.heros._heros
 * From constant.json: startHero="1205", startHeroLevel="3"
 * From HeroAttribute (line 84951): 31 attributes, all default 0 except _level
 */
function generateDefaultHero(userId) {
    const heroId = userId; // hero instance ID = userId

    return {
        _heros: {
            [heroId]: {
                _heroId: heroId,
                _heroDisplayId: GAME_CONSTANTS.startHero,
                _heroStar: 0,
                _heroTag: [0],
                _fragment: 0,
                _superSkillResetCount: 0,
                _potentialResetCount: 0,
                _expeditionMaxLevel: 0,
                _heroBaseAttr: {
                    _level: parseInt(GAME_CONSTANTS.startHeroLevel),
                    _evolveLevel: 0,
                    // All 31 attributes default to 0 (from HeroAttribute constructor line 84951)
                    _hp: 0, _attack: 0, _armor: 0, _speed: 0,
                    _hit: 0, _dodge: 0, _block: 0, _blockEffect: 0,
                    _skillDamage: 0, _critical: 0, _criticalResist: 0,
                    _criticalDamage: 0, _armorBreak: 0, _damageReduce: 0,
                    _controlResist: 0, _trueDamage: 0, _energy: 0,
                    _power: 0, _extraArmor: 0, _hpPercent: 0,
                    _armorPercent: 0, _attackPercent: 0, _speedPercent: 0,
                    _orghp: 0, _superDamage: 0, _healPlus: 0,
                    _healerPlus: 0, _damageDown: 0, _shielderPlus: 0,
                    _damageUp: 0,
                },
                _superSkillLevel: {},
                _potentialLevel: {},
                _qigong: null,
                _qigongTmp: null,
                _qigongStage: 1,
                _qigongTmpPower: 0,
                _totalCost: null,
                _breakInfo: null,
                _gemstoneSuitId: null,
                _linkTo: null,
                _linkFrom: null,
            },
        },
    };
}

/**
 * Generate complete enterGame response for a NEW user
 *
 * 100% from UserDataParser.saveUserData() (line 77643-77724)
 * and constant.json initial values.
 *
 * @param {string} userId
 * @param {string} nickName
 * @param {number} serverId
 * @returns {object} Complete enterGame response data
 */
function generateNewUserData(userId, nickName, serverId) {
    const now = Date.now();

    return {
        // ==========================================
        // CORE FIELDS (unconditional, no null check)
        // ==========================================

        // currency (line 77642): ts.currency = e.currency
        // Client reads unconditionally: ts.currency = e.currency
        currency: {
            _diamond: GAME_CONSTANTS.startDiamond,
            _gold: GAME_CONSTANTS.startGold,
        },

        // broadcastRecord (line 77449): ts.chatJoinRecord({_record: t.broadcastRecord})
        // Client iterates with for(var o in t) — must be array (chat message list)
        // newUser is NOT here — it's a response-time flag set by enterGame, not persistent data
        broadcastRecord: [],

        // user (line 77670-77673): setUserInfo(e)
        // Reads e.user._id, e.user._nickName, etc. unconditionally
        user: {
            _id: userId,
            _pwd: '',
            _nickName: nickName || userId,
            _headImage: GAME_CONSTANTS.playerIcon,
            _lastLoginTime: now,
            _createTime: now,
            _bulletinVersions: {},
            _oriServerId: serverId || 1,
            _nickChangeTimes: 0,
        },

        // hangup (line 77674-77678): setOnHook(e)
        // Reads e.hangup._curLess, e.hangup._maxPassLesson, etc.
        hangup: {
            _curLess: GAME_CONSTANTS.startLesson,
            _maxPassLesson: GAME_CONSTANTS.startLesson,
            _maxPassChapter: GAME_CONSTANTS.startChapter,
            _haveGotChapterReward: {},
            _clickGlobalWarBuffTag: '',
            _buyFund: false,
            _haveGotFundReward: {},
        },

        // summon (line 77678-77682): setSummon(e)
        // From summonEnergy.json: summonEnergy = 800
        summon: {
            _energy: 800,
            _wishList: [],
            _wishVersion: 0,
            _canCommonFreeTime: 0,
            _canSuperFreeTime: 0,
            _summonTimes: {},
        },

        // totalProps (line 77683-77692): setBackpack(e)
        // Reads e.totalProps._items as {[itemId]: {_id, _num}}
        totalProps: generateDefaultTotalProps(),

        // backpackLevel (line 77692): e.backpackLevel -> UserInfoSingleton.heroBackPack
        // Top-level field, NOT inside totalProps
        backpackLevel: 1,

        // imprint (line 77693-77701): setSign(e)
        // Reads e.imprint._items
        imprint: { _items: [] },

        // equip (line 77703-77709): setEquip(e)
        // Reads e.equip._suits as {[heroId]: {_suitItems, _suitAttrs, ...}}
        equip: { _suits: {} },

        // weapon (line 77704): weapon._items -> WeaponDataModel.deserialize
        weapon: { _items: {} },

        // genki (line 77705): genkiDataModel.deserialize(e.genki)
        // Guarded: e.genki && t.genkiDataModel.deserialize(e.genki)
        // GenkiItem reads: _level, _heroId, _heroDisplayId, _timeType, _finishTime
        genki: {_items: []},

        // heros (line 77687): HerosManager.readByData(e.heros)
        // Reads e.heros._heros as {[heroId]: {hero data}}
        heros: generateDefaultHero(userId),

        // superSkill (line 77685): superSkill._skills -> iterated, stored if _level != 0
        superSkill: { _skills: {} },

        // heroSkin (line 77686): HeroSkinModel.setSkinsWithServerData(e.heroSkin)
        // Guarded: e.heroSkin &&  ... reads _skins, _curSkin
        heroSkin: {_skins: {}, _curSkin: {}},

        // scheduleInfo (line 58004-58006): AllRefreshCount.initData(e.scheduleInfo)
        // ALL fields below are read from e.scheduleInfo in initData().
        // Fields WITHOUT void 0 != guard are read UNCONDITIONALLY — must exist or crash!
        // Verified against client constructor (line 58000) for default values.
        scheduleInfo: {
            // === UNCONDITIONAL (no guard) — CRASH if missing ===
            _marketDiamondRefreshCount: 0,
            _vipMarketDiamondRefreshCount: 0,
            _arenaAttackTimes: 0,
            _arenaBuyTimesCount: 0,
            _snakeResetTimes: 0,
            _snakeSweepCount: 0,
            _cellGameHaveGotReward: true,       // boolean, default true in constructor
            _cellGameHaveTimes: 0,
            _cellgameHaveSetHero: false,         // boolean, default false in constructor
            _strongEnemyTimes: 0,
            _strongEnemyBuyCount: 0,
            _mergeBossBuyCount: 0,
            // CounterpartSingleton.setCounterPartTime(e._dungeonTimes) — unconditional
            _dungeonTimes: 0,
            // CounterpartSingleton.setCounterPartBuyCount(e._dungeonBuyTimesCount) — unconditional
            _dungeonBuyTimesCount: 0,
            _karinBattleTimes: 0,
            _karinBuyBattleTimesCount: 0,
            _karinBuyFeetCount: 0,
            _entrustResetTimes: 0,
            // Dragon exchange — unconditional
            _dragonExchangeSSPoolId: 0,
            _dragonExchangeSSSPoolId: 0,
            // Team dungeon robots — unconditional, default [] in constructor
            _teamDugeonUsedRobots: [],
            // Space trial — unconditional (stored as _spaceTrialBuyCount on client)
            _timeTrialBuyTimesCount: 0,
            // Month card — unconditional
            _monthCardHaveGotReward: {},
            // Gold buy — unconditional
            _goldBuyCount: 0,
            // Like rank — unconditional
            _likeRank: {},
            // Maha adventure — unconditional
            _mahaAttackTimes: 0,
            _mahaBuyTimesCount: 0,
            // Guild — unconditional
            _guildBossTimes: 0,
            _guildBossTimesBuyCount: 0,
            _treasureTimes: 0,
            // Guild check-in — unconditional, passed to TeamInfoManager.playerSignInID()
            _guildCheckInType: 0,
            // Top battle — unconditional
            _topBattleTimes: 0,
            _topBattleBuyCount: 0,
            // Temple — unconditional
            _templeDailyReward: null,
            _templeYesterdayLess: null,
            // Click time gift — unconditional, boolean default false in constructor
            _clickTimeGift: false,
            // Expedition — unconditional assignments (not guarded)
            _clickExpedition: false,
            _expeditionSpeedUpCost: 0,
            // Gravity trial — unconditional
            _gravityTrialBuyTimesCount: 0,

            // === GUARDED with void 0 != (safe if missing, but include for completeness) ===
            _mineResetTimes: 0,
            _mineBuyResetTimesCount: 0,
            _mineBuyStepCount: 0,
            _templeBuyCount: 0,
            _trainingBuyCount: 0,
            _bossCptTimes: 0,
            _bossCptBuyCount: 0,
            _ballWarBuyCount: 0,
            // Expedition events — guarded (e._expeditionEvents &&)
            _expeditionEvents: null,
        },

        // dungeon (line 77710-77714): setCounterpart(e)
        // Reads e.dungeon._dungeons
        dungeon: { _dungeons: {} },

        // serverId (line 77723): UserInfoSingleton.getInstance().setServerId(e.serverId)
        // Top-level field, read unconditionally
        serverId: serverId || 1,

        // curMainTask (line 77720-77721): UserInfoSingleton.setMianTask(e.curMainTask)
        // Line 62521-62523: setMianTask does Object.keys(e).length check
        // CANNOT be null! Object.keys(null) throws TypeError
        // Empty array [] is safe: Object.keys([]).length === 0 -> sets _mainTask = null
        curMainTask: [],

        // ==========================================
        // WELFARE / GIFT FIELDS
        // ==========================================

        // giftInfo (line 77647-77650): WelfareInfoManager
        // Reads e.giftInfo._fristRecharge, e.giftInfo._haveGotVipRewrd, etc.
        //
        // FIX: _onlineGift must be an OBJECT with _curId and _nextTime, NOT a number.
        // Client WelfareInfoManager.setOnlineGift(e) reads e._curId and e._nextTime.
        // If _onlineGift is 0 (number), then 0._curId → undefined → crash.
        // Client Home.setOnLineGift() then calls getOnLineCurId() which returns undefined,
        // and onlineBonus[undefined].nextID → TypeError: can't access property "nextID".
        //
        // Client OnlineGiftItem constructor (line 88097):
        //   this._curId = 0;
        //   this._nextTime = 0;
        giftInfo: {
            _fristRecharge: 0,
            _haveGotVipRewrd: 0,
            _buyVipGiftCount: 0,
            _onlineGift: { _curId: 0, _nextTime: 0 },   // FIX: was `_onlineGift: 0`
            _gotBSAddToHomeReward: 0,
            _clickHonghuUrlTime: 0,
        },

        // checkin (line 77702-77703): WelfareInfoManager.setSignInInfo(e.checkin)
        // Guarded: e.checkin && WelfareInfoManager.setSignInInfo(e.checkin)
        checkin: {_activeItem: [], _curCycle: 1, _maxActiveDay: 1, _lastActiveDate: ''},

        // monthCard (line 77651): WelfareInfoManager.setMonthCardInfo(e.monthCard)
        // Guarded: e.monthCard &&  ... CardItem reads _endTime
        monthCard: {_id: '', _card: {}},

        // recharge (line 77652): WelfareInfoManager.setRechargeInfo(e.recharge)
        // Guarded: e.recharge &&  ... iterates _haveBought
        recharge: {_id: '', _haveBought: {}},

        // vipLog: WelfareInfoManager.setVipLogList(e.vipLog)
        // Guarded: e.vipLog &&  ... iterates array of SummonLog
        vipLog: [],

        // cardLog: WelfareInfoManager.setMonthCardLogList(e.cardLog)
        // Guarded: e.cardLog &&  ... iterates array of CardLog
        cardLog: [],

        // timeBonusInfo: TimeLimitGiftBagManager.setTimeLimitGiftBag(e.timeBonusInfo)
        // Guarded: e.timeBonusInfo &&  ... BonusItem reads _endTime, _giftID, _isBuy, _buyRemian, _thingsId
        timeBonusInfo: {_id: '', _timeBonus: {}},

        // userDownloadReward: contains _isClick, _haveGotDlReward, _isBind, _haveGotBindReward
        // Guarded: e.userDownloadReward &&  ... _isClick and _haveGotDlReward use || !1 fallback
        userDownloadReward: {_isClick: false, _haveGotDlReward: false, _isBind: false, _haveGotBindReward: false},

        // channelSpecial (line 77689): WelfareInfoManager.channelSpecial = e.channelSpecial
        // Guarded: e.channelSpecial &&  ... reads _honghuUrl, _honghuUrlStartTime, _honghuUrlEndTime
        channelSpecial: {_show: false, _vip: 0, _hideHeroes: [], _honghuUrl: '', _honghuUrlStartTime: 0, _honghuUrlEndTime: 0},

        // hideHeroes: WelfareInfoManager.setHideHeroes(e.hideHeroes)
        // Guarded: e.hideHeroes &&  ... iterates array
        hideHeroes: [],

        // enableShowQQ, showQQVip, showQQ, showQQImg1, showQQImg2, showQQUrl
        // QQ platform-specific fields
        enableShowQQ: false,
        showQQVip: false,
        showQQ: false,
        showQQImg1: '',
        showQQImg2: '',
        showQQUrl: '',

        // ==========================================
        // GUILD / TEAM FIELDS
        // ==========================================

        // userGuild (line 77715): TeamInfoManager.setUserTeamInfoModel(e.userGuild)
        userGuild: null,

        // userGuildPub (line 77716): TeamInfoManager.setUserTeamInfoModel(e.userGuildPub)
        userGuildPub: null,

        // guildLevel (line 77716): TeamInfoManager.setMyTeamLevel(e.guildLevel)
        guildLevel: 0,

        // guildTreasureMatchRet: GuildTreasureManager.setTreasureMatchState()
        guildTreasureMatchRet: 0,

        // guildName (line): TeamInfoManager.setTeamName(e.guildName)
        // Direct assignment: this.myTeamInfo._name = e
        guildName: '',

        // guildActivePoints: TeamInfoManager.setActivePoints(e.guildActivePoints)
        // Guarded: e.guildActivePoints &&  ... iterates {[type]: number}
        guildActivePoints: {},

        // teamTraining: TeamTrainingManager.saveTeamTraining(e.teamTraining)
        // Guarded: e.teamTraining &&  ... reads _levels, _unlock, _version
        teamTraining: {_levels: {}, _unlock: false, _version: ''},

        // ==========================================
        // ARENA / PVP FIELDS
        // ==========================================

        // _arenaTeam (line 77656): AltarInfoManger.setArenaTeamInfo(e._arenaTeam)
        // NOTE: Leading underscore - client reads e._arenaTeam directly
        // Guarded: e._arenaTeam && AltarInfoManger.setArenaTeamInfo(e._arenaTeam)
        _arenaTeam: {},

        // _arenaSuper (line 77657): AltarInfoManger.setArenaSuperInfo(e._arenaSuper)
        // NOTE: Leading underscore - client reads e._arenaSuper directly
        // Guarded: e._arenaSuper && AltarInfoManger.setArenaSuperInfo(e._arenaSuper)
        _arenaSuper: [],

        // lastTeam (line 77661): reads e.lastTeam._lastTeamInfo -> firstLoginSetMyTeam()
        // Line 62326-62342: firstLoginSetMyTeam iterates keys, creates LastTeamInfo per type
        // Line 62343: getMyTeamByType(e) accesses t._lastTeamInfo[e]
        // Line 62606: LAST_TEAM_TYPE.HANGUP = 9 (used by OnHookSingleton.getLastOnHookTeam)
        //
        // IMPORTANT: New user starts with EMPTY HANGUP team (no pre-placed heroes).
        // The tutorial (steps 2105-2107) teaches the user to manually select heroes.
        // If a hero is pre-placed here, initGotoBattle() will pre-place it in formation,
        // then clickHeroListItem() will toggle-REMOVE it instead of adding it (BUG).
        // Client safely handles empty team: battleTeamRemoveDecomposeHero() returns []
        // when team is undefined/empty (line 54713: if(!t) return n).
        // Team is saved properly after tutorial step 2107 via saveGuideTeam.
        lastTeam: {
            _lastTeamInfo: {
                9: {  // LAST_TEAM_TYPE.HANGUP
                    _team: [],
                    _superSkill: [],
                },
            },
        },

        // ==========================================
        // EXPEDITION / DUNGEON FIELDS
        // ==========================================

        // expedition (line 77669): ExpeditionManager.setExpeditionModel(e.expedition)
        // Guarded: e.expedition &&  ... reads _passLesson, _machines, _collection, _teams, _times
        expedition: {_passLesson: 0, _machines: {}, _collection: [], _teams: {}, _times: 10},

        // teamDungeon: TeamworkManager.setLoginInfo(e.teamDungeon)
        // Guarded: e.teamDungeon &&  ... reads _myTeam, _canCreateTeamTime, _nextCanJoinTime
        teamDungeon: {_myTeam: '', _canCreateTeamTime: 0, _nextCanJoinTime: 0},

        // teamServerHttpUrl: TeamworkManager.teamServerHttpUrl
        // Guarded: e.teamServerHttpUrl &&  ... string URL
        teamServerHttpUrl: '',

        // teamDungeonOpenTime: TeamworkManager.teamDungeonOpenTime
        // Guarded: e.teamDungeonOpenTime != null
        teamDungeonOpenTime: 0,

        // teamDungeonTask: TeamworkManager.teamDungeonTask.deserialize(e.teamDungeonTask)
        // Guarded: e.teamDungeonTask &&  ... reads _achievement, _daily, _dailyRefreshTime
        teamDungeonTask: {_achievement: {}, _daily: {}, _dailyRefreshTime: 0},

        // teamDungeonSplBcst: SetTeamDungeonBroadcast(e.teamDungeonSplBcst, true)
        // Guarded: e.teamDungeonSplBcst &&  ... iterates object
        teamDungeonSplBcst: {},

        // teamDungeonNormBcst: SetTeamDungeonBroadcast(e.teamDungeonNormBcst, false)
        // Guarded: e.teamDungeonNormBcst &&  ... iterates object
        teamDungeonNormBcst: {},

        // teamDungeonHideInfo: TeamworkManager.setTeamDungeonHideInfo(e.teamDungeonHideInfo)
        // Guarded: e.teamDungeonHideInfo &&  ... object
        teamDungeonHideInfo: {},

        // teamDungeonInvitedFriends: TeamworkManager.teamDungeonInvitedFriends
        // Guarded: e.teamDungeonInvitedFriends &&  ... array of user IDs
        teamDungeonInvitedFriends: [],

        // myTeamServerSocketUrl: ts.loginInfo.serverItem.dungeonurl
        // Guarded: e.myTeamServerSocketUrl &&  ... string URL
        myTeamServerSocketUrl: '',

        // ==========================================
        // TRIAL / TOWER FIELDS
        // ==========================================

        // templeLess: TrialManager.setTempleLess(e.templeLess)
        // Guarded: e.templeLess != null
        templeLess: 0,

        // timeTrial: SpaceTrialManager.setSpaceTrialModel(e.timeTrial, e.timeTrialNextOpenTime)
        // Guarded: e.timeTrial &&  ... reads _levelStars, _totalStars, _haveTimes, _startTime
        timeTrial: {_levelStars: {}, _totalStars: 0, _haveTimes: 0, _startTime: 0, _openDays: ''},

        // timeTrialNextOpenTime: (see above)
        // Guarded: e.timeTrialNextOpenTime != null
        timeTrialNextOpenTime: 0,

        // gravity: TrialManager.setGravityTrialInfo(e) -- reads e.gravity from full response
        // Guarded: e.gravity &&  ... GravityTrialModel reads _id, _haveTimes, _timesStartRecover, _lastLess, _lastTime
        gravity: {_id: '', _haveTimes: 0, _timesStartRecover: 0, _lastLess: 0, _lastTime: 0},

        // littleGame: LittleGameManager.saveData(e.littleGame)
        // Guarded: e.littleGame &&  ... reads _gotBattleReward, _gotChapterReward, _clickTime
        littleGame: {_gotBattleReward: {}, _gotChapterReward: {}, _clickTime: 0},

        // cellgameHaveSetHero: scheduleInfo._cellgameHaveSetHero = e.cellgameHaveSetHero
        // Top-level boolean field
        cellgameHaveSetHero: false,

        // ==========================================
        // GLOBAL WAR FIELDS (top-level, NOT inside hangup)
        // Source: UserDataParser reads e.globalWarBuffTag etc. directly
        // ==========================================

        // Guarded: read by setOnHook() as e.globalWarBuffTag etc.
        globalWarBuffTag: '',
        globalWarLastRank: {},
        globalWarBuff: 0,
        globalWarBuffEndTime: 0,

        // ==========================================
        // BALL WAR FIELDS
        // ==========================================

        // userBallWar: TeamInfoManager.UserBallWar = e.userBallWar
        // Guarded: e.userBallWar &&
        userBallWar: {_times: 0, _fieldId: '', _nextCanFightTime: 0, _history: {}, _score: 0, _rank: 0},
        // ballWarState: TeamInfoManager.BallWarState = e.ballWarState
        ballWarState: 0,
        // ballBroadcast: TeamInfoManager.setBallWarBrodecast(e.ballBroadcast)
        // Guarded: e.ballBroadcast &&  ... treats as array
        ballBroadcast: [],
        // ballWarInfo: GuildBallWarInfo.deserialize(e.ballWarInfo)
        // Guarded: e.ballWarInfo &&  ... Serializable: _signed, _fieldId, _point, _topMsg
        ballWarInfo: {_signed: false, _fieldId: '', _point: 0, _topMsg: ''},

        // ==========================================
        // TOP BATTLE FIELDS
        // ==========================================

        // topBattleInfo: TopBattleManager.setTopBattleLoginInfo(e) reads e.topBattleInfo
        // Guarded: e.topBattleInfo &&
        topBattleInfo: {_stage: 0, _season: 0, _stageFinishTime: 0, _areaId: 0, _point: 0, topBattleInfo: null, topUserInfo: {}, lastChampion: null},
        // userTopBattle: TopBattleManager.setTopBattleLoginInfo(e) reads e.userTopBattle
        // Guarded: e.userTopBattle &&
        userTopBattle: {_id: '', _teams: {}, _teamTag: '', _records: [], _history: [], _bet: {}, _gotRankReward: []},

        // summonLog (line 61545-61551): SummonSingleton.setSummomLogList(e)
        // Guarded: e.summonLog &&  ... iterates array of SummonLog objects
        summonLog: [],

        // blacklist (line 58622-58625): BroadcastSingleton.setBlacklistPlayerInfo(e)
        // Guarded: e.blacklist &&  ... iterates array
        blacklist: [],

        // ==========================================
        // MISC GAME FIELDS
        // ==========================================

        // clickSystem (line 77656): UserClickSingleton
        // Reads e.clickSystem._clickSys -> iterates key->value
        clickSystem: {
            _clickSys: { 1: false, 2: false },
        },

        // dragonEquiped (line 77716): ItemsCommonSingleton.initDragonBallEquip(e.dragonEquiped)
        dragonEquiped: {},

        // timesInfo (line 77653): TimesInfoSingleton.initData(e.timesInfo)
        // Guarded: e.timesInfo &&  ... reads templeTimes, mineSteps, karinFeet, mahaTimes, etc.
        timesInfo: {templeTimes: 10, mineSteps: 0, karinFeet: 5, mahaTimes: 0, marketRefreshTimes: 0, mahaGoldBuyCount: 0, treasureTimes: 0, mahaInviteCount: 0, mahaRecoverBuyCount: 0, mahaRecoverTimes: 0},

        // guide (line 77654): GuideInfoManager.setGuideInfo(e.guide)
        // Guarded: e.guide &&  ... reads _id, _steps
        guide: {_id: '', _steps: {}},

        // timeMachine (line 77655): TimeLeapSingleton.initData(e.timeMachine)
        // Guarded: e.timeMachine &&  ... TimeMachineItem reads _level, _heroId, _heroDisplayId, _timeType, _finishTime
        timeMachine: {_items: {}},

        // gemstone: EquipInfoManager.saveGemStone(e) reads e.gemstone._items
        // Guarded: e.gemstone &&  ... iterates e.gemstone._items with for(var n in ...)
        gemstone: {_items: {}},

        // resonance (line 77675): HerosManager.setResonanceModel(e.resonance)
        // Guarded: e.resonance &&  ... ResonanceModel: _id, _diamondCabin, _cabins, _buySeatCount, _totalTalent, _unlockSpecial
        resonance: {_id: '', _diamondCabin: 0, _cabins: {}, _buySeatCount: 0, _totalTalent: 0, _unlockSpecial: false},

        // fastTeam (line 77676): HerosManager.saveLoginFastTeam(e.fastTeam)
        // Guarded: e.fastTeam &&  ... iterates e._teamInfo with for(var n in ...)
        // FastTeam constructor: team={}, superSkill=[], name=""
        fastTeam: {_teamInfo: {}},

        // battleMedal (line 77672): BattleMedalManager.setBattleMedal(e.battleMedal)
        // Guarded: e.battleMedal &&
        battleMedal: {_battleMedalId: '', _cycle: 1, _level: 0, _curExp: 0, _openSuper: false, _skillLevel: 0, _haveUseTimes: 0, _buyTimes: 0, _totalMedal: 0, _buyMedal: 0, _todayGetMedal: 0},

        // retrieve: GetBackReourceManager.setRetrieveModel(e.retrieve)
        // Guarded: e.retrieve &&
        retrieve: {_finishDungeons: {}, _calHangupTime: 0, _retrieveHangupTime: 0, _dungeonBuyTime: 0, _haveRetrieveDungeons: {}},

        // training: PadipataInfoManager.setPadipataModel(e.training)
        // Guarded: e.training &&
        training: {_type: 0, _cfgId: 0, _times: 10, _timesStartRecover: 0, _recoverTime: 0, _padipataHeroList: {}, _isFinish: false, _lastTime: 0},

        // warInfo: GlobalWarManager.setWarLoginInfo(e.warInfo)
        // Guarded: e.warInfo &&
        warInfo: null,

        // userWar: GlobalWarManager.setUserWarModel(e.userWar)
        // Guarded: e.userWar &&
        userWar: {_session: 0, _worldId: 0, _areaId: 0, _auditionWinCount: 0, _bet: {}, _auditionPoint: 0, _auditionMaxPoint: 0, _auditionBattleTimes: 0, _isChampion: false},

        // headEffect: new HeadEffectModel; r.deserialize(e.headEffect)
        // Guarded: e.headEffect &&
        headEffect: {_curBox: 0, _curEffect: 0, _effects: []},

        // questionnaires: UserInfoSingleton.setQuestData(e.questionnaires)
        // Guarded: e.questionnaires &&
        questionnaires: {},

        // YouTuberRecruit: contains _hidden field
        // Guarded: e.YouTuberRecruit &&
        YouTuberRecruit: {_id: 'YouTuberRecruitPlan', _image: '', _reward: {}, _jumpLink: '', _hidden: true},

        // userYouTuberRecruit: YouTuberModel.initUserInfo(e.userYouTuberRecruit)
        // Guarded: e.userYouTuberRecruit &&
        userYouTuberRecruit: {_hasJoin: false, _gotReward: false, _joinTime: 0},

        // forbiddenChat: BroadcastSingleton.setUserBidden(e.forbiddenChat)
        // Guarded: e.forbiddenChat &&
        forbiddenChat: {users: [], finishTime: {}},

        // shopNewHeroes: ShopInfoManager.shopNewHeroes = e.shopNewHeroes
        // Direct assignment (not guarded, but object is safe)
        shopNewHeroes: {},

        // ==========================================
        // SERVER INFO FIELDS
        // ==========================================

        // serverVersion: UserInfoSingleton.serverVersion = e.serverVersion
        // Set by enterGame handler from configModule.config.version
        serverVersion: '',

        // serverOpenDate (line 77724): UserInfoSingleton.setServerOpenDate(e.serverOpenDate)
        serverOpenDate: now,

        // heroImageVersion: UserInfoSingleton.heroImageVersion = e.heroImageVersion
        heroImageVersion: 0,

        // superImageVersion: UserInfoSingleton.superImageVersion = e.superImageVersion
        superImageVersion: 0,

        // onlineBulletin: BulletinSingleton.setBulletInfo(e.onlineBulletin)
        // Guarded: e.onlineBulletin &&
        onlineBulletin: [],

        // karinStartTime: TowerDataManager.setKarinTime(e.karinStartTime, e.karinEndTime)
        // Set by enterGame handler from server config
        karinStartTime: 0,

        // karinEndTime: (see above)
        // Set by enterGame handler from server config
        karinEndTime: 0,
    };
}

/**
 * Merge loaded user data with defaults to prevent null crashes
 *
 * PROBLEM: When loading existing user data from database, some fields
 * may be null/undefined from previous test runs or data corruption.
 * The client's UserDataParser.saveUserData() reads many fields UNCONDITIONALLY
 * (no null check), causing TypeError crashes like:
 *   Object.keys(null) -> TypeError: can't convert null to object (setMainTask)
 *   e.currency._diamond -> TypeError: cannot read property '_diamond' of null
 *   e.hangup._curLess -> TypeError: cannot read property '_curLess' of null
 *
 * FIELDS THAT MUST NOT BE NULL (client reads unconditionally):
 *   currency, user, hangup, summon, totalProps, heros, superSkill,
 *   scheduleInfo, dragonEquiped, clickSystem, curMainTask
 *
 * @param {object|null} loadedData - Data loaded from database (may have nulls)
 * @param {string} userId - User ID for generating fresh defaults
 * @param {string} nickName - Nickname for defaults
 * @param {number} serverId - Server ID for defaults
 * @returns {object} Sanitized data safe for client consumption
 */
function mergeWithDefaults(loadedData, userId, nickName, serverId) {
    // Generate fresh defaults as the base
    const defaults = generateNewUserData(userId, nickName, serverId);
    const HANGUP_DEFAULTS = {
        _curLess: GAME_CONSTANTS.startLesson,
        _maxPassLesson: GAME_CONSTANTS.startLesson,
        _maxPassChapter: GAME_CONSTANTS.startChapter,
        _haveGotChapterReward: {},
        _clickGlobalWarBuffTag: '',
        _buyFund: false,
        _haveGotFundReward: {}
    };

    if (!loadedData || typeof loadedData !== 'object') {
        return defaults;
    }

    // For each key in defaults, use loaded value only if non-null
    for (const key of Object.keys(defaults)) {
        if (loadedData.hasOwnProperty(key) && loadedData[key] !== null && loadedData[key] !== undefined) {
            defaults[key] = loadedData[key];
        }
    }

    // DEEP MERGE hangup: ensure all default sub-fields exist
    // even if loadedData.hangup is missing some of them.
    // Without this, a DB row with hangup:{_curLess:10101} but missing
    // _maxPassLesson would lose the default → client crash.
    if (defaults.hangup && typeof defaults.hangup === 'object') {
        for (const hk of Object.keys(HANGUP_DEFAULTS)) {
            if (defaults.hangup[hk] === null || defaults.hangup[hk] === undefined) {
                defaults.hangup[hk] = HANGUP_DEFAULTS[hk];
            }
        }
    }

    // FIX: Validate _onlineGift format
    // Client expects { _curId: number, _nextTime: number }
    // If loaded data has _onlineGift as a number (old format) or missing/wrong type, fix it.
    if (defaults.giftInfo && typeof defaults.giftInfo === 'object') {
        var og = defaults.giftInfo._onlineGift;
        if (og === null || og === undefined || typeof og !== 'object') {
            // Old/corrupt format: was 0 (number) or missing
            var oldCurId = 0;
            if (typeof og === 'number' && og > 0) {
                // Preserve the old value as _curId if it was a valid number
                oldCurId = og;
            }
            defaults.giftInfo._onlineGift = { _curId: oldCurId, _nextTime: 0 };
        } else {
            // It's an object — ensure it has the required fields
            if (typeof og._curId !== 'number') og._curId = 0;
            if (typeof og._nextTime !== 'number') og._nextTime = 0;
        }
    }

    // Also preserve any extra keys from loadedData that aren't in defaults
    // (future-proofing for new fields added in updates)
    for (const key of Object.keys(loadedData)) {
        if (!defaults.hasOwnProperty(key)) {
            defaults[key] = loadedData[key];
        }
    }

    return defaults;
}

module.exports = { generateNewUserData, generateDefaultTotalProps, generateDefaultHero, mergeWithDefaults, GAME_CONSTANTS, ITEM_IDS };
