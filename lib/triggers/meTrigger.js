//Skeleton for new triggers
//-------------------------
var util = require("util");
const Faceit = require("faceit-js");
var apikey = process.env.faceitapi || "";
const api = new Faceit(apikey);


// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");

// Add the Firebase products that you want to use
require("firebase/auth");
require("firebase/database");
require("firebase/firestore");

var fusername = process.env.fusername || "";
var fpassword = process.env.fpassword || "";

var BaseTrigger = require("./baseTrigger.js").BaseTrigger;
var MeTrigger = function() {
	MeTrigger.super_.apply(this, arguments);
};
util.inherits(MeTrigger, BaseTrigger);
var type = "MeTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new MeTrigger(type, name, chatBot, options);
	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers
	return trigger;
};

// Return true if a message was sent
MeTrigger.prototype._respondToFriendMessage = function(userId, message) {
	if(this.options.source==="group") {
		return false;
	}
	return this._respond(userId, message, userId);
}

// Return true if a message was sent
MeTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	if(this.options.source==="pm") {
		return false;
	}
	return this._respond(roomId, message, chatterId);
}

// Check for any text match
MeTrigger.prototype._checkMessage = function(message, matches) {
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

MeTrigger.prototype._respond = function(toId, message, fromId) {
	var dest = toId;
	if(this.options.inPrivate) {
		dest=fromId;
	}
	message = message.message.split("?").join(":");
	if (!message) {
		return false;
	}
	
	var spl = message.toLowerCase().split(' ');
	if (this._checkMessage(spl[0], this.options.matches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			var ref = firebase.database().ref('players/'+fromId).get()
			.then((val) => {
				var mes = "I have this information about you: \r\nSteam ID: " + fromId + "\r\n";
				if(typeof(val.val().faceit) !== 'undefined') {
					// Get Faceit info from database
					mes += "Faceit ID: " + val.val().faceit + "\r\n";
				}
				if(typeof(val.val().role) !== 'undefined') {
					mes += "Your role: " + val.val().role + "\r\n";
				}
				
				// If message was sent in group chat
				if(message.hasOwnProperty('chat_group_id')) {
					this.chatBot.user.sendChatMessage(message.chat_group_id, message.chat_id, mes);
				}
				// It was a private message
				else {
					this._sendMessageAfterDelay(dest, mes);
				}

			}).catch((error) => {
				console.error(error);
			});
			
		})
		.catch((error) => {
			console.error(error);
		});
		return true;
	}
	return false;
}