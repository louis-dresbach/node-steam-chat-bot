//Skeleton for new triggers
//-------------------------
var util = require("util");

var BaseTrigger = require("./baseTrigger.js").BaseTrigger;
var TeamSpeakTrigger = function() {
	TeamSpeakTrigger.super_.apply(this, arguments);
};
util.inherits(TeamSpeakTrigger, BaseTrigger);
var type = "TeamSpeakTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new TeamSpeakTrigger(type, name, chatBot, options);
	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers
	return trigger;
};

const { TeamSpeak } = require("ts3-nodejs-library");

const matches = ["!ts", "!teamspeak"]; 

var tsIp = process.env.tsIp || "127.0.0.1";
var tsPort = process.env.tsPort || 9987;
var tsUsername = process.env.tsUsername || "";
var tsPassword = process.env.tsPassword || "";

// Link structure
// https://voicecommandcenter.com/knowledgebase/28/HOW-TO-Link-to-my-Teamspeak-3-Server-on-my-webpage.html
// ts3server://{ip}?port={port}&channel={channel name}&channelpassword={password}
// ts3server://k3i.de?port=9987&channel=╔- Team Alpha&channelpassword=
//
// http://invite.teamspeak.com/voice.teamspeak.com/?port=9987&channel=a&channelpassword=a


// Return true if a message was sent
TeamSpeakTrigger.prototype._respondToFriendMessage = function(userId, message) {
	if(this.options.source==="group") {
		return false;
	}
	return this._respond(message);
}

// Return true if a message was sent
TeamSpeakTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	if(this.options.source==="pm") {
		return false;
	}
	return this._respond(message);
}

// Check for any text match
TeamSpeakTrigger.prototype._checkMessage = function(message, matches) {
	if (!this.options.matches || this.options.matches.length === 0) {
		return true; // match-all
	}

	for (var i=0; i < matches.length; i++) {
		var match = matches[i];
		if (message === match.toLowerCase()) {

			return true;
		}
	}

	return false;
}

TeamSpeakTrigger.prototype._respond = function(message) {
	this.chatBot.winston.debug("TeamSpeakTrigger responding");
	mess = message.message.split("?").join(":");
	if (!mess) {
		return false;
	}
	
	var spl = mess.toLowerCase().split(' ');
	if (this._checkMessage(spl[0], this.options.matches)) {
		if(spl[1]) {
			var that = this;
			switch(spl[1]) {
				case "create":
					var cname = "abc";
					var cpass = "abc";
					
					this._connect.then(teamspeak => {
						teamspeak.ChannelCreate(cname, ChannelEdit= {
							channelPassword: cpass,
							channelFlagPermanent: false,
							channelDescription: "Temporary channel created by steambot"
						}).then(() => {
							this._sendMessageAfterDelay(message, "Created new channel " + cname + " with password " + cpass + "\r\nUse this link to connect:\r\n");
							this._sendMessageAfterDelay(message, this._link(cname, cpass));
						}).catch(e => {
							this.chatBot.winston.debug("Error with Channel creation:");
							this.chatBot.winston.error(e);
						});
					}).catch(e => {
						this.chatBot.winston.debug("Error with teamspeak:");
						this.chatBot.winston.error(e);
					});
					break;
				case "info":
				default: // Give info about the server
					this._info(message);
					break;
			}
		}
		else { // No user specified, display sender info
			this._info(message);
		}
		return true;
	}
	return false;
}

TeamSpeakTrigger.prototype._info = function(message) {
	this.chatBot.winston.debug("Sending information about the teamspeak server");
	this._connect.then(teamspeak => {
		teamspeak.whoami().then(whoami => {
			this.chatBot.winston.debug(whoami);
		});
	}).catch(e => {
	  this.chatBot.winston.debug("Error with teamspeak:");
	  this.chatBot.winston.error(e);
	});
}

TeamSpeakTrigger.prototype._connect = function() {
	return TeamSpeak.connect({
	  host: tsIp,
	  serverport: tsPort,
	  username: tsUsername,
	  password: tsPassword,
	  nickname: "K3i Steam-chat-bot"
	});
}

TeamSpeakTrigger.prototype._link = function(channel, channelpassword) {
	var link = "ts3server://" + tsIp + "?port=" + tsPort + "&channel=" + channel + "&channelpassword=" + channelpassword;
	return link;
}