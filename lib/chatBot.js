const ver = "3.0"; //update this before pushing to master.

const fs = require("fs");
const steam = require("steam");
const winston = require("winston");
const _ = require("lodash");
const http = require("http");
const Express = require('express');
const expressWinston = require('express-winston');
const TriggerFactory = require("./triggerFactory.js").TriggerFactory;
const qs = require('qs');
const crypto = require('crypto');

const steamClient = require('steam-user');

var wcfg = { //define some extra logLevels for winston, also colors
	levels: {
		spam: 0,
		protocol: 1,
		silly: 2,
		verbose: 3,
		info: 4,
		data: 5,
		warn: 6,
		debug: 7,
		error: 8,
		failure: 9
	},
	colors: {
		spam:'bold',
		protocol:'grey',
		silly:'magenta',
		verbose:'cyan',
		info:'green',
		data:'gray',
		warn:'yellow',
		debug:'blue',
		error:'red',
		failure:'rainbow'
	}
}

// Bot should be usually created without options, it is a parameter mainly for testing
var ChatBot = function(username, password, options) {
	var that = this;
	this._gitVersionString();
	if(username instanceof Object) {
		options = username;
		if(options.username) username = options.username;
		if(options.password) password = options.password;
	}
	this.options = options || {};

	this.winston = new (winston.Logger)({
		levels:wcfg.levels,
		colors: options.winstonColors||wcfg.colors
	});

	this.steamClient = options.client || new steamClient();
	this.name = options.name || username;
	this.username = username;
	this.password = password;
	if(options.guardCode) {
		this.guardCode = options.guardCode;
	} else {
		this.guardCode = undefined;
	}
	if(options.twoFactorAuth instanceof Function) {
		this.twoFactorAuth = options.twoFactorAuth;
	} else if (options.twoFactorAuth) {
		this.twoFactorAuth = function(){ return options.twoFactorAuth };
	} else {
		this.twoFactorAuth = function(){ return undefined; };
	}
	this.apikey = options.steamapikey || undefined;
	this.games = [];
	this.logFile = undefined;
	this.cookie = undefined;
	this.ignores = options.ignores || [];
	this.startTime = process.hrtime();
	this.logoffTime = process.hrtime();
	this.autojoinRooms = undefined;

	if(!fs.existsSync(this.name)) { fs.mkdirSync(this.name); }

	this.autojoinFile = options.autojoinFile || this.name+"/bot." + this.name+".autojoin";
	this.logFile = options.hasOwnProperty('logFile') ? options.logFile : this.name+"/bot."+this.name+".log";
	if (this.logFile===undefined||this.logFile===true) { this.logFile = this.name+"/bot."+this.name+".log"; }
	
	this.keyFile = options.hasOwnProperty('keyFile') ? options.keyFile : this.name+"/bot."+this.name+"key.txt";
	if (this.keyFile===undefined||this.keyFile===true) { this.keyFile = this.name+"/bot."+this.name+"key.txt"; }

	this.winston.add(winston.transports.Console,{
		handleExceptions: false,
		colorize: options.consoleColors||true,
		timestamp: options.consoleTime||true,
		level: options.consoleLogLevel||"info",
		json: false
	});

	if(!fs.existsSync(this.name+"/firstRun")) {
		var c = require('colors/safe');
		console.error(c.white.bgBlack('=================='));
		console.error(c.bgBlack.cyan("The location and names of default files has been changed."));
		console.error(c.bgBlack.cyan("All files should now either be located in the default bot folder with the default name, or should be specified in the config.You can continue to store the config file wherever you like."));
		console.error(c.bgBlack.cyan("The default folder is the bot's `name`, which defaults to the username but can be changed in the constructor. \n"));
		console.error(c.bgBlack.cyan("Default filenames for this bot are as follows:"));
		var t = function(a,b){
			console.error("    "+c.bgBlack.magenta(a)+c.bgBlack.cyan(" : ")+c.bgBlack.green(b));
		}
		t("autojoinFile",this.name+"/bot."+this.name+".autojoin");
		t("logFile     ",this.name+"/bot."+this.name+".log");
		console.error();
		console.error(c.bgBlack.cyan("*The servers file is an exception, as it is not specific to any one bot."));
		console.error(c.bgBlack.cyan("Individual triggers that have not yet moved their default storage location will have it moved in a coming release."));
		console.error(c.bgBlack.cyan("This message will not appear again."));
		console.error(c.white.bgBlack('=================='));
		fs.writeFileSync(this.name+"/firstRun","The presence of this file indicates that you received a message regarding the new default location of bot files.");
		process.exit();
	}

	if(!this.logFile===false) {
		this.winston.info(this.name+"/chatBot.js: logging output to: " + this.logFile);
		this.winston.add(
			winston.transports.File, {
				level: options.logLevel || "info",
				colorize:false,
				timestamp:true,
				filename: that.logFile,
				json:false
			}
		);
	}

	this.connected = false; // Bot is connected to the steam network
	this.muted = false; // Should not send any messages to a chat room when muted

	this.winston.silly(this.name+"/chatBot.js: Starting triggerFactory");
	this.triggers = {};
	if (options.triggerFactory) {
		this.triggerFactory = options.triggerFactory;
	} else {
		this.triggerFactory = new TriggerFactory();
	}

	this.unmutedState = steam.EPersonaState.Online;
	this.mutedState = steam.EPersonaState.Snooze;

	if(options.onLogon instanceof Function) {
		this.onLogon = options.onLogon;
	}

	//Steam-client events
	this.steamClient.on("error",                   function(err)              { that._onError(err); });
	this.steamClient.on("loggedOn",                function(res)              { that._onLogOnResponse(res); that.onLogon(that); that.triggerLoggedOn(); });
	this.steamClient.on("disconnected",            function(eresult)          { that._onDisconnected(eresult); that.triggerLoggedOff(); });
	this.steamClient.on("loginKey",                function(key)              { that._onNewKey(key); });

	//Steam-user events
	this.steamClient.on('tradeOffers',             function(number)           { that._onTradeOffers(number); });

	//Steam-friends events
	this.steamClient.on("chatInvite",              function(roomId, roomName, inviterId)      { that._onChatInvite(roomId, roomName, inviterId); });
	this.steamClient.on("friendRelationship",      function(userId, relationship)             { that._onRelationship(userId, relationship); });
	this.steamClient.on("friendMessage",           function(userId, message)                  { that._onFriendMsg(userId, message); });
	this.steamClient.chat.on("chatMessage",        function(message)                          { that._onChatMsg(message); });

	//Steam-trading events
	this.steamClient.on('tradeRequest',            function(tradeID, steamID)         { that._onTradeProposed(tradeID, steamID, that.acceptTrade); });
	this.steamClient.on('tradeResponse',           function(tradeID, result, steamID) { that._onTradeResult(tradeID, result, steamID) });
	
	this.autoReconnect = true;
};

ChatBot.prototype.restart = function() {
	this.winston.info('Chat bot ' + this.name + ' attempting to restart');
	
	var trig = this.getTriggerDetails();
	this.steamClient.logOff();
	this.addTriggers(trig);
}


// Public interface
ChatBot.prototype.onLogon = function(bot) {
	return;
}

ChatBot.prototype._onNewKey = function(key) {
	fs.writeFile(this.keyFile, key, function(err, result) {
		if(err) this.winston.error(err);
	});
}

ChatBot.prototype.connect = function() {
	this.winston.info(this.name+"/chatBot.js: Trying to connect");
	
	var key = fs.readFile(this.keyFile, 'utf8', function (err, data) {
		if(err) this.winston.error(err);
	});
	
	this.steamClient.logOn({ 
		accountName : this.username,
		password: this.password,
		authCode : this.guardCode,
		twoFactorCode : this.twoFactorAuth(),
		rememberPassword : true
	});
}

ChatBot.prototype.log = function(){};

ChatBot.prototype.mute = function() {
	this.muted = true;
	this._updatePersonaState();
}

ChatBot.prototype.unmute = function() {
	this.muted = false;
	this._updatePersonaState();
}

// Run the .onLoggedOff function for each trigger
ChatBot.prototype.triggerLoggedOff = function() {
	if(!this.triggers || this.triggers.length === 0) {
		return;
	}
	var that = this;
	this.logoffTime = process.hrtime();
	_.each(this.triggers, function(trigger) {
		try {
			that.winston.debug(that.name+"/chatBot.js: Running onLoggedOff for " + trigger.type + " trigger " + trigger.name);
			trigger.onLoggedOff();
			return null;
		} catch(err) {
			that.winston.error(that.name+"/chatBot.js: Error running onLoggedOff for " + trigger.type + " trigger " + trigger.name,err.stack);
		}
	});
	return null;
}

// Run the .onLoggedOn function for each trigger
ChatBot.prototype.triggerLoggedOn = function() {
	if(!this.triggers || this.triggers.length === 0) {
		return;
	}
	this.logonTime = process.hrtime();
	var that = this;
	_.each(this.triggers, function(trigger) {
		try {
			that.winston.debug(that.name+"/chatBot.js: Running onLoggedOn for " + trigger.type + " trigger " + trigger.name);
			trigger.onLoggedOn();
			return null;
		} catch(err) {
			that.winston.error(that.name+"/chatBot.js: Error running onLoggedOn for " + trigger.type + " trigger " + trigger.name,err.stack);
		}
	});
	return null;
}

// Add or replace a trigger - return the trigger or null
ChatBot.prototype.addTrigger = function(name, type, options) {
	if (!name || !type) {
		this.winston.error(this.name+"/chatBot.js ("+(name||type||"unknown trigger")+"): Trigger not correctly defined. Not loading. Name and type are both required.");
		return false;
	}

	this.removeTrigger(name);

	var trigger = this.triggerFactory.createTrigger(type, name, this, options || {}, true);

	try {
		this.winston.debug(this.name+"/chatBot.js: Testing onLoad for " + type + " trigger " + name);
		if (trigger && trigger.onLoad()) {
			this.winston.silly(this.name+"/chatBot.js: onLoad success for " + type + " trigger " + name);
			this.triggers[name] = trigger;
			return trigger;
		} else if (trigger) {
			this.winston.error(this.name+"/chatBot.js: Error loading " + type + " trigger " + name);
			return null;
		}
	} catch(err) {
		this.winston.error(this.name+"/chatBot.js: Error loading " + type + " trigger " + name + ":",err.stack);
	}
	return null;
}

// Any duplicate names will be replaced
// triggers is of the form [{name:"",type:"",options:{}}, {name:"",type:"",options:{}}, etc]
// Returns true if all were added, false if any couldn't be added
ChatBot.prototype.addTriggers = function(triggers) {
	var ok = true;
	var that = this;
	_.each(triggers, function(trigger) {
		ok = ok && (that.addTrigger(trigger.name, trigger.type, trigger.options) != null);
		if(!ok) {
			that.winston.error(that.name+"/chatBot.js: trigger not loaded because it or a previous trigger failed to load:",trigger);
		}
	});
	return ok;
}

// Returns true if the trigger was removed
ChatBot.prototype.removeTrigger = function(name) {
	if (name in this.triggers) {
		this.winston.debug(this.name+"/chatBot.js: Deleting trigger: "+name);
		delete this.triggers[name];
		return true;
	}
	return false;
}

ChatBot.prototype.clearTriggers = function(callback) {
	var that = this;

	this.winston.debug(this.name+"/chatBot.js: Clearing triggers");
	this.triggers = {};

	//allow users to redo their own webserver functions afterwards
	if(callback && callback instanceof Function) {
		callback();
	}
}

// Returns triggers in the same form that can be used for addTriggers
// [{name:"",type:"",options:{}}, {name:"",type:"",options:{}}, etc]
ChatBot.prototype.getTriggerDetails = function() {
	var triggerDetails = [];

	_.each(this.triggers, function(trigger, name) {
		triggerDetails.push({ name: name, type: trigger.type, options: trigger.getOptions() });
	});

	return triggerDetails;
}

ChatBot.prototype.sendMessage = function(steamId, message) {
	this.steamClient.chatMessage(steamId, message);
	var haveSeenMessage = false;
	_.each(this.triggers, function(trigger) {
		var seenMessageThisTrigger = trigger.onSentMessage(steamId, message, haveSeenMessage);
		haveSeenMessage = haveSeenMessage || seenMessageThisTrigger;
	});
}

//left this here because some configs might still be using it?
ChatBot.prototype.joinGame = function(appId) {
	this.games=[appId];				//update this.games
	this.steamClient.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(appId) }] });
}

//this function will play all the games it's told to. This doesn't always show
//the first game as the one being played, so there's another function that
//plays the first game, then waits a fraction of a second to play the others
ChatBot.prototype.setGames = function(appIdArray) {
	var that = this;
	this.games=appIdArray;				//update this.games
	if(this.games) this.winston.info(this.name+"/chatBot.js: Playing gameIDs " + this.games.toString());
	else this.winston.info(this.name+"/chatBot.js: Playing nothing");
	this.steamClient.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(that.games.toString()) }] });	//play them!
}

ChatBot.prototype.setPrimaryGame = function(appId,delay) {
	this.winston.info(this.name+"/chatBot.js: Setting " + appId + " as primary game.");
	if(!this.games || this.games === undefined){
		this.games=[appId];
	} else {
		this.games.unshift(appId);			//update this.games
	}
	this.winston.info(this.name+"/chatBot.js: Playing gameID " + appId);
	this.steamClient.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(appId) }] });		//first, play only this game, so it shows up
	var that = this;
	setTimeout(function(){
		that.winston.info(that.name+"/chatBot.js: Playing gameIDs " + that.games.toString());
		that.steamClient.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(that.games.toString()) }] });	//play them!
	},(delay||1000));	//play all the games in 1 second.
}

ChatBot.prototype.send = function(header, body, callback) {
	this.winston.protocol(this.name+'/chatBot.js: sending ProtoBuf message: ' + header.msg + (header.proto ? ', ' + JSON.stringify(header.proto) : ''));
	this.steamClient.send(header, body, callback);
}

ChatBot.prototype.joinChat = function(roomId, autoJoinAfterDisconnect) {
	this.winston.info("Chat bot " + this.name + " joining room " + roomId + " with autoJoinAfterDisconnect " + autoJoinAfterDisconnect);
	this.steamClient.joinChat(roomId);
	if (autoJoinAfterDisconnect) {
		this._addChatToAutojoin(roomId);
	}
}

ChatBot.prototype.leaveChat = function(roomId) {
	this.winston.info("Chat bot " + this.name + " leaving room " + roomId);
	this._removeChatFromAutojoin(roomId);
	this.steamClient.leaveChat(roomId);
}

ChatBot.prototype.addFriend = function(userId) {
	this.winston.info("Chat bot " + this.name + " adding friend " + this._userString(userId));
	this.steamClient.addFriend(userId);
}

ChatBot.prototype.removeFriend = function(userId) {
	this.winston.info("Chat bot " + this.name + " removing friend " + this._userString(userId));
	this.steamClient.removeFriend(userId);
}

ChatBot.prototype.setPersonaName = function(name) {
	this.winston.info("Chat bot " + this.name + " changing name to " + name);
	this.steamClient.setPersonaName(name);
}

ChatBot.prototype.setPersonaState = function(state) {
	this.winston.info("Chat bot " + this.name + " changing state to " + state);
	this.steamClient.setPersona(state);
}

ChatBot.prototype.lockChat = function(roomId) {
	this.winston.info("Chat bot " + this.name + " locking chat " + roomId);
	this.steamClient.lockChat(roomId);
}

ChatBot.prototype.unlockChat = function(roomId) {
	this.winston.info("Chat bot " + this.name + " unlocking chat " + roomId);
	this.steamClient.unlockChat(roomId);
}

ChatBot.prototype.setModerated = function(roomId) {
	this.winston.info("Chat bot " + this.name + " moderating chat " + roomId);
	this.steamClient.setModerated(roomId);
}

ChatBot.prototype.setUnmoderated = function(roomId) {
	this.winston.info("Chat bot " + this.name + " unmoderating chat " + roomId);
	this.steamClient.setUnmoderated(roomId);
}

ChatBot.prototype.kick = function(roomId, userId) {
	this.winston.info("Chat bot " + this.name + " kicking " + this._userString(userId) + " from " + roomId);
	this.steamClient.kick(roomId, userId);
}

ChatBot.prototype.ban = function(roomId, userId) {
	this.winston.info("Chat bot " + this.name + " banning " + this._userString(userId) + " from " + roomId);
	this.steamClient.ban(roomId, userId);
}

ChatBot.prototype.unban = function(roomId, userId) {
	this.winston.info("Chat bot " + this.name + " unbanning " + this._userString(userId) + " from " + roomId);
	this.steamClient.unban(roomId, userId);
}

ChatBot.prototype.users = function() {
	return this.steamClient.user;
}

ChatBot.prototype.rooms = function() {
	return this.steamClient.chatRooms;
}

ChatBot.prototype.friends = function() {
	return this.steamClient.friends;
}

ChatBot.prototype.groups = function() {
	return this.steamClient.groups;
}

ChatBot.prototype.logOff = function() {
	this.winston.info('Chat bot ' + this.name + ' logging off');
	this.steamClient.disconnect();
}

ChatBot.prototype.chatInvite = function(chatSteamID, invitedSteamID) {
	this.winston.info("Chat bot " + this.name+': Inviting ' + invitedSteamID + ' to chat ' + chatSteamID);
	this.steamClient.chatInvite(chatSteamID, invitedSteamID);
}

ChatBot.prototype.getSteamLevel = function(steamids) {
	this.winston.info(this.name+'/chatBot.js: Getting steam level for ' + steamids.toString());
	return this.steamClient.getSteamLevel(steamids, function(levels) {
		return levels;
	});
}

ChatBot.prototype.setIgnoreFriend = function(steamID, setIgnore) {
	this.winston.info(this.name+'/chatBot.js: Setting ' + steamID + ' block to ' + setIgnore);
	var that = this.
	this.steamClient.setIgnoreFriend(steamID, setIgnore, function(callback) {
//		that.winston.info(callback); //i don't know what this callback does
					//	^ so you decided to log a function?
	});
}

ChatBot.prototype.trade = function(steamID) {
	this.winston.info(this.name+'/chatBot.js: Sending trade request to ' + steamID);
	this.steamClient.trade(steamID);
}

ChatBot.prototype.respondToTrade = function(tradeID, bool) {
	if(bool === true) {
		this.steamClient.respondToTrade(tradeID, true);
		this.winston.info(this.name+'/chatBot.js: Accepting trade');
	} else {
		this.steamClient.respondToTrade(tradeID, false);
		this.winston.info(this.name+'/chatBot.js: Denying trade');
	}
}

ChatBot.prototype.cancelTrade = function(steamID) {
	this.winston.info(this.name+'/chatBot.js: Cancelling trade to ' + steamID);
	this.steamClient.cancelTrade(steamID);
}

ChatBot.prototype.steamApi = function(interface, method, version, request, key, options) {
	var that = this;
	if(!key) {
		that.winston.error(that.name+'/chatBot.js: Usage of Steam API requires an API key');
	}
	else {
		return new Promise(function(resolve, reject) {
			var endpoint = GetInterface(interface, key);
			if(request === 'get') {
				endpoint.get(method, parseInt(version), options, function(code, response) {
					if(code !== 200) {
						reject(code);
					}
					else {
						resolve(response);
					}
				});
			}
			else if(request === 'post') {
				endpoint.post(method, parseInt(version), options, function(code, response) {
					if(code !== 200) {
						reject(code);
					}
					else {
						resolve(response);
					}
				});
			}
		});
	}
}

// "Private" functions

ChatBot.prototype._updatePersonaState = function() {
	this.steamClient.setPersona(this.muted ? this.mutedState : this.unmutedState);
}

ChatBot.prototype._userString = function(id) {
	var result = (this.steamClient.users && id in this.steamClient.users) ? (this.steamClient.users[id].player_name + "/") : "";
	result += id;

	return result;
};
//same as _userString, but only the name without the steamID
ChatBot.prototype._userName = function(id) {
	var result = (this.steamClient.users && id in this.steamClient.users) ? (this.steamClient.users[id].player_name) : "";
	return result;
};
////
ChatBot.prototype._autojoinChatrooms = function() {
	// Auto-join chat rooms that the bot was previously invited to (and not removed from)
	if (fs.existsSync(this.autojoinFile)) {
		this.autojoinRooms = JSON.parse(fs.readFileSync(this.autojoinFile));
		var that = this;
		_.each(that.autojoinRooms, function(value, roomId) {
			that.winston.info("Chat bot " + that.name + " auto-joining room " + roomId);
			that.steamClient.joinChat(roomId);
		});
	}
}

ChatBot.prototype._addChatToAutojoin = function(roomId) {
	if (fs.existsSync(this.autojoinFile)) {
		this.autojoinRooms = JSON.parse(fs.readFileSync(this.autojoinFile));
	}
	else {
		this.autojoinRooms = {};
	}
	this.autojoinRooms[roomId] = true;

	fs.writeFileSync(this.autojoinFile, JSON.stringify(this.autojoinRooms));
}

ChatBot.prototype._removeChatFromAutojoin = function(roomId) {
	if (fs.existsSync(this.autojoinFile)) {
		this.autojoinRooms = JSON.parse(fs.readFileSync(this.autojoinFile));
		if (this.autojoinRooms[roomId]) {
			delete this.autojoinRooms[roomId];
			fs.writeFileSync(this.autojoinFile, JSON.stringify(this.autojoinRooms));
		}
	}
}

// Steam Events

ChatBot.prototype._onMessage = function(header, body, callback) {
	this.winston.protocol(this.name+'/chatBot.js: new ProtoBuf message: ' + header.msg + (header.proto ? ', ' + JSON.stringify(header.proto) : ''));
}

ChatBot.prototype._onError = function(err) {
	this.winston.error(this.name+"/chatBot.js: disconnected due to an error: "+err);
	this.connected = false;
	if(this.autoReconnect) {
		this.connect();
	}
};
var evilEResults = {
	5: "Incorrect password",
	7: "Please update steam-chat-bot and/or node-steam",
	18:"Your account doesn't exist",
	25:"Try again later",
	43:true,
	56:"Reset your password through support",
	63:"Login denied due to steamguard, provide guard code sent to email",
	65:"Wrong guard code",
	66:"Check your guardCode",
	71:"Guard code is expired",
	73:"Your account is locked",
	74:"Your account is locked. Please verify through email"
}
//Try again how much faster than babysitInterval? (don't get locked out, but don't wait 30min because steam is down...)
//Never tries more often than 5s anyways.
var badEResults = {
	2:  0.5, 3:  0.1, 4:  0.1, 20: 0.5, 35: 0.3,
	36: 0.3, 37: 0.3, 38: 0.3, 48: 0.1, 79: 0.5
}
ChatBot.prototype._onLogOnResponse = function(res) {
	var that = this;
	if(res.eresult === steam.EResult.OK) {
		this.winston.info(this.name + "/chatBot.js: logged on");
		this.connected = true;
		this._updatePersonaState();
		this._autojoinChatrooms();
		this.steamClient.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(that.games.toString()) }] });
	} else if(res.eresult === 63) {
		this.winston.warn(this.name + '/chatBot.js: EResult for logon response: 63 (AccountLogonDenied). Please provide the guardCode sent to your email at ' + res.email_domain);
		//I'm not sure if we might want to use exit codes in the future? Just set exit codes to eresult num plus 100, leaving 1-100 open.
		process.exit(163);
	} else { //if any other eresults need extra data, we should separate them as well.
		var reason = res.eresult+" ("+this._getEResult(res.eresult)+"). "+(evilEResults[res.eresult] || "Please fix the issue and try again.");
		this.winston.warn(this.name + '/chatBot.js: EResult for logon response: ' +reason);
		//open steamworks has comment explanations of many eresults.
		this.winston.verbose("You can find more information on some EResults in Open Steamworks header comments at https://github.com/SteamRE/open-steamworks/blob/master/Open%20Steamworks/EResult.h");
		if(res.eresult in evilEResults) {
			process.exit(res.eresult+100); //evilEResults are things that won't be fixed by waiting (bad login, etc)
		}
		if(res.eresult in badEResults) { //not as bad as evilEResults; steam is down, or sth, so connect faster than usual.
			if(this.eresultReconnect) { //only try once, though. Don't want to get rate limited. After that, let babysitter take over.
				return;
			}
			var timer = (this.options.babysitTimer||5*60*1000)*badEResults[res.eresult];
			if(timer <5000) { timer=5000; }
			setTimeout(function() { that.logOn(); }, timer);
			this.eresultReconnect = true;
		}
	}
}

ChatBot.prototype._getEResult = function(num) {
	for (var result in steam.EResult) {
		if(steam.EResult[result]===num) {
			return result;
		}
	}
	return false;
}

ChatBot.prototype._onDisconnected = function() {
	this.winston.warn(this.name + "/chatBot.js: disconnected");

	if(this.autoReconnect) {
		this.connect();
	}
}

ChatBot.prototype._onChatInvite = function(roomId, roomName, inviterId) {
	this.winston.info(this.name + "/chatBot.js: was invited to chat in " + roomName + " (" + roomId + ")" + " by " + this._userString(inviterId));

	_.each(this.triggers, function(trigger) {
		trigger.onChatInvite(roomId, roomName, inviterId);
	});
};

ChatBot.prototype._onRelationship = function(userId, relationship) {
	this.winston.info(this.name + "/chatBot.js: relationship event for " + this._userString(userId) + " type " + relationship);

	if (relationship === 2) {
		_.each(this.triggers, function(trigger) {
			trigger.onFriendRequest(userId);
		});
	}
};

ChatBot.prototype._onFriendMsg = function(userId, message) {
	this.winston.info(this.name + "/chatBot.js: friendMsg <" + this._userString(userId) + ">: " + message);
	
	var haveSentMessage = false;
	_.each(this.triggers, function(trigger) {
		var sentMessageThisTrigger = trigger.onFriendMessage(userId, message, haveSentMessage);
		haveSentMessage = haveSentMessage || sentMessageThisTrigger;
	});
};

ChatBot.prototype._onChatMsg = function(message) {
	// https://github.com/DoctorMcKay/node-steam-user/wiki/SteamChatRoomClient#incoming-chat-message
	this.winston.info(this.name + "/chatBot.js: chatMsg in " + message.chat_id + " <" + this._userString(message.steamid_sender) + ">: " + message.message);
	
	var that = this;
	var haveSentMessage = false;
	_.each(this.triggers, function(trigger) {
		var sentMessageThisTrigger = trigger.onChatMessage(message, haveSentMessage, that.muted);
		haveSentMessage = haveSentMessage || sentMessageThisTrigger;
	});
};

ChatBot.prototype._onChatStateChange = function(stateChange, chatterActedOn, steamChatId, chatterActedBy) {
	this.winston.info(this.name + "/chatBot.js: chatStateChange " + stateChange + " in " + steamChatId + " " + chatterActedOn + " acted on by " + chatterActedBy);
	var muted = this.muted;
	var haveSentMessage = false;
	var sentMessageThisTrigger = false;

	if ((stateChange & steam.EChatMemberStateChange.Kicked) > 0) {
		this.winston.info(this.name+"/chatBot.js:"+this._userString(chatterActedOn) + " was kicked from " + steamChatId + " by " + this._userString(chatterActedBy));

		// Kicked from chat - don't autojoin
		if(chatterActedOn === this.steamClient.steamID) {
			this._removeChatFromAutojoin(steamChatId);
		}

		haveSentMessage = false;
		_.each(this.triggers, function(trigger) {
			sentMessageThisTrigger = trigger.onKickedChat(steamChatId, chatterActedOn, chatterActedBy, haveSentMessage, muted);
			haveSentMessage = haveSentMessage || sentMessageThisTrigger;
		});
	}

	else if ((stateChange & steam.EChatMemberStateChange.Entered) > 0) {
		this.winston.info(this.name+"/chatBot.js:"+this._userString(chatterActedOn) + " joined " + steamChatId);

		haveSentMessage = false;
		_.each(this.triggers, function(trigger) {
			sentMessageThisTrigger = trigger.onEnteredChat(steamChatId, chatterActedOn, haveSentMessage, muted);
			haveSentMessage = haveSentMessage || sentMessageThisTrigger;
		});
	}
	else if ((stateChange & steam.EChatMemberStateChange.Left) > 0) {
		this.winston.info(this.name+"/chatBot.js:"+this._userString(chatterActedOn) + " left " + steamChatId);

		haveSentMessage = false;
		_.each(this.triggers, function(trigger) {
			sentMessageThisTrigger = trigger.onLeftChat(steamChatId, chatterActedOn, haveSentMessage, muted);
			haveSentMessage = haveSentMessage || sentMessageThisTrigger;
		});
	}
	else if ((stateChange & steam.EChatMemberStateChange.Disconnected) > 0) {
		this.winston.info(this.name+"/chatBot.js:"+this._userString(chatterActedOn) + " was disconnected from " + steamChatId);

		haveSentMessage = false;
		_.each(this.triggers, function(trigger) {
			sentMessageThisTrigger = trigger.onDisconnected(steamChatId, chatterActedOn, haveSentMessage, muted);
			haveSentMessage = haveSentMessage || sentMessageThisTrigger;
		});
	}
	else if ((stateChange & steam.EChatMemberStateChange.Banned) > 0) {
		this.winston.info(this.name+"/chatBot.js:"+this._userString(chatterActedOn) + " was banned from " + steamChatId);

		haveSentMessage = false;
		_.each(this.triggers, function(trigger) {
			sentMessageThisTrigger = trigger.onBannedChat(steamChatId, chatterActedOn, chatterActedBy, haveSentMessage, muted);
			haveSentMessage = haveSentMessage || sentMessageThisTrigger;
		});
	}
};

ChatBot.prototype._onTradeOffers = function(number) { //this function gets called when someone sends a non-interactive trade offer. There are no built-in functions for dealing with this.
	this.winston.info(this.name+'/chatBot.js: New trade offer count: ' + number);
	var haveEatenEvent = false;
	_.each(this.triggers, function(trigger) {
		var eatenEventThisTrigger = trigger.onTradeOffer(number,haveEatenEvent);
		haveEatenEvent = haveEatenEvent || eatenEventThisTrigger;
	});
}

ChatBot.prototype._onTradeProposed = function(tradeID, steamID) { //interactive trading session.
	this.winston.info(this.name+'/chatBot.js: Received trade request from ' + steamID);
	var haveEatenEvent = false;
	_.each(this.triggers, function(trigger) {
		var eatenEventThisTrigger = trigger.onTradeProposed(tradeID,steamID,haveEatenEvent);
		haveEatenEvent = haveEatenEvent || eatenEventThisTrigger;
	});
}

ChatBot.prototype._onTradeResult = function(tradeID, result, steamID) {
	this.winston.info(this.name+"/chatBot.js: " + result + ' from trade with ' + steamID);
}

ChatBot.prototype._onSessionStart = function(steamID) {
	this.winston.info(this.name+'/chatBot.js: Trade with ' + steamID + ' initialized');
	var haveEatenEvent = false;
	_.each(this.triggers, function(trigger) {
		var eatenEventThisTrigger = trigger.onTradeSession(steamID,haveEatenEvent);
		haveEatenEvent = haveEatenEvent || eatenEventThisTrigger;
	});
}

ChatBot.prototype.makeAnnouncement = function(target, head, body, source) {
	var that = this;
	var post_data = qs.stringify({
		"sessionID" : that.steamClient.sessionID,
		"action" : "post",
		"headline" : head,
		"body" : body
	});
	var post_options = {
		host: "steamcommunity.com",
		port: "80",
		path: "/groups/"+target+"/announcements/create",
		method: "POST",
		headers: {
			"Content-Type" : "application/x-www-form-urlencoded",
			"Content-Length" : post_data.length,
			"cookie" : that.cookie
		}
	};
	var post_req = http.request(post_options, function(res) {
		res.setEncoding("utf8");
		res.on("data", function(chunk) {
			that.winston.info(that.name+"/chatBot.js: Announcement created: " + head);
			if(source) {
				that.steamClient.chatMessage(source, "Announcement created: " + head);
			} else {
				return head;
			}
		});
	});
	post_req.write(post_data);
	post_req.end();
	that.winston.debug(that.name+"/chatBot.js: post_data",post_data)
	that.winston.debug(that.name+"/chatBot.js: post_options",post_options);
}

ChatBot.prototype._gitVersionString = function(hashlength) {
	var that = this;
	this.version = {short:ver};
	var exec = require('child_process').exec;
	exec("cd "+__dirname+" && git status -sb", function(err,stdout,stderr) {
		if(err||stderr||!stdout) {
			that.version.git=false;
			return;
		}
		that.version.git=true;
		stdout = stdout.split(/\r\n|\n/)[0]       //only needs the first line
				.replace(/.+\//,'')       //remove everything up to the remote branch name
				.replace(/\[|\]| |,/g,'') //remove formatting
				.replace('ahead',' +')    //format
				.replace('behind',' -');
		that.version.gitBranch = stdout.replace(/ +.+| -.+/,'');
		that.version.gitChanges = stdout.substring(that.version.gitBranch.length);
		exec("cd "+__dirname+" && git rev-parse --short="+(hashlength||0)+" HEAD", function(err,stdout,stderr) {
			if(err||stderr||!stdout) {
				return;
			}
			stdout = stdout.split(/\r\n|\n/)[0]       //only needs the first line
			that.version.gitHash = stdout||false;
			exec("cd "+__dirname+" && git status -s", function(err,stdout,stderr) {
				if(err||stderr) {
					return;
				}
				that.version.gitDirty=stdout ? "*" : ""; //output is blank if it's clean
				if(that.version.gitBranch) {
					that.version.string = that.version.short.replace("-dev","-git");
					that.version.string += " ("+that.version.gitBranch+that.version.gitDirty+") "
					that.version.string += that.version.gitHash+that.version.gitChanges;
				}
			});
		});
	});
}
exports.ChatBot = ChatBot;
