//Skeleton for new triggers
//-------------------------
var util = require("util");
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
var LobbyTrigger = function() {
	LobbyTrigger.super_.apply(this, arguments);
};
util.inherits(LobbyTrigger, BaseTrigger);
var type = "LobbyTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new LobbyTrigger(type, name, chatBot, options);
	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers
	return trigger;
};

// Return true if a message was sent
LobbyTrigger.prototype._respondToFriendMessage = function(userId, message) {
	if(this.options.source==="group") {
		return false;
	}
	return this._respond(userId, message, userId);
}

// Return true if a message was sent
LobbyTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	if(this.options.source==="pm") {
		return false;
	}
	return this._respond(roomId, message, chatterId);
}

// Check for any text match
LobbyTrigger.prototype._checkMessage = function(message, matches) {
	if (!this.options.matches || this.options.matches.length === 0) {
		return true; // match-all
	}
	
	var spl = message.toLowerCase().split(' ');

	for (var i=0; i < matches.length; i++) {
		var match = matches[i];
		if (spl[0] === match.toLowerCase()) {

			return true;
		}
	}

	return false;
}

LobbyTrigger.prototype._respond = function(toId, message, fromId) {
	var dest = toId;
	if(this.options.inPrivate) {
		dest=fromId;
	}
	message = message.split("?").join(":");
	if (!message) {
		return false;
	}
	if (this._checkMessage(message, this.options.matches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			var queued = false;
			var ref = firebase.database().ref('entries');
			var p = ref.orderByChild("id").equalTo(fromId).get()
			.then((val) => {
				queued = true;
			});
			
			if(queued) {
				this._sendMessageAfterDelay(dest, "You are already queued.");
			}
			else {
				ref.push({
					id: fromId,
					mode: "Faceit",
					readytime: "20:00",
					time: Date.now()
				});
				this._sendMessageAfterDelay(dest, "You have been added to the queue.");
			}
		})
		.catch((error) => {
			console.error(error);
		});
		return true;
	}
	if (this._checkMessage(message, this.options.rmatches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			var queued = false;
			var ref = firebase.database().ref('entries');
			var p = ref.orderByChild("id").equalTo(fromId).get()
			.then((val) => {
				queued = true;
				ref.remove(val.key);
			});
			
			if(queued) {
				this._sendMessageAfterDelay(dest, "Removed queue.");
			}
			else {
				this._sendMessageAfterDelay(dest, "You are not queued yet. Please use !queue to add yourself.");
			}
		})
		.catch((error) => {
			console.error(error);
		});
		return true;
	}
	return false;
}