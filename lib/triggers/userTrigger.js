//Skeleton for new triggers
//-------------------------
var util = require("util");

var BaseTrigger = require("./baseTrigger.js").BaseTrigger;
var UserTrigger = function() {
	UserTrigger.super_.apply(this, arguments);
};
util.inherits(UserTrigger, BaseTrigger);
var type = "UserTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new UserTrigger(type, name, chatBot, options);
	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers
	return trigger;
};

const matches = ["!user", "!u"];

// Return true if a message was sent
UserTrigger.prototype._respondToFriendMessage = function(userId, message) {
	if(this.options.source==="group") {
		return false;
	}
	//return this._respond(message);
}

// Return true if a message was sent
UserTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	if(this.options.source==="pm") {
		return false;
	}
	//return this._respond(message);
}

// Check for any text match
UserTrigger.prototype._checkMessage = function(message, matches) {
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

UserTrigger.prototype._respond = function(message) {
	mess = message.message.split("?").join(":");
	if (!mess) {
		return false;
	}
	
	var spl = mess.toLowerCase().split(' ');
	if (this._checkMessage(spl[0], this.options.matches)) {
		if(spl[1]) {
			
		}
		else { // No user specified, display sender info
			this._sendMessageAfterDelay(message, steamClient.users[message.steam_id]);
		}
		return true;
	}
	return false;
}