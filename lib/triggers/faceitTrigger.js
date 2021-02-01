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

var fusername = process.env.FirebaseUsername || "";
var fpassword = process.env.FirebasePassword || "";

var BaseTrigger = require("./baseTrigger.js").BaseTrigger;
var FaceitTrigger = function() {
	FaceitTrigger.super_.apply(this, arguments);
};
util.inherits(FaceitTrigger, BaseTrigger);
var type = "FaceitTrigger";
exports.triggerType = type;
exports.create = function(name, chatBot, options) {
	var trigger = new FaceitTrigger(type, name, chatBot, options);
	trigger.respectsMute = true;
	trigger.respectsFilters = true;
	// Other initializers
	return trigger;
};

// Return true if a message was sent
FaceitTrigger.prototype._respondToFriendMessage = function(userId, message) {
	if(this.options.source==="group") {
		return false;
	}
	return this._respond(userId, message, userId);
}

// Return true if a message was sent
FaceitTrigger.prototype._respondToChatMessage = function(roomId, chatterId, message) {
	if(this.options.source==="pm") {
		return false;
	}
	return this._respond(roomId, message, chatterId);
}

FaceitTrigger.prototype._getAndSend = function (originalMessage, faceitId) {
	api.players(faceitId, "", "")
	.then((d) => {
		var message = "Your Faceit stats: \r\n"
		+ "ELO: " + d.games.csgo.faceit_elo + " [Level " + d.games.csgo.skill_level + "] \r\n"
		+ (d.faceit_url).replace("{lang}", "en");
		this._sendMessageAfterDelay(originalMessage, message);
	}).catch((error) => {
		this.chatBot.winston.error(error);
		this._sendMessageAfterDelay(originalMessage, "An error occured: " + error);
	});
}

FaceitTrigger.prototype._respond = function(toId, message, fromId) {
	var dest = toId;
	if(this.options.inPrivate) {
		dest=fromId;
	}
	mess = message.message.split("?").join(":");
	if (!mess) {
		return false;
	}
	
	var spl = mess.toLowerCase().split(' ');
	if (this._checkMessage(spl[0], this.options.matches)) {
		firebase.app();
		
		var ref = firebase.database().ref('players/'+fromId).once("value")
		.then((val) => {
			if(typeof(val.val()) !== 'undefined' && val.val() != null && typeof(val.val().faceit) !== 'undefined') {
				// Get Faceit info from database
				this._getAndSend(message, val.val().faceit);
			}
			else {
				// Fetch it using the faceit api
				this._sendMessageAfterDelay(dest, "I do not yet have your Faceit account in my database. ");
				api.searchPlayer(fromId, 0, 1)
				.then((data) => {
					if(data.items.length == 1) {
						// Store it in firebase
						firebase.database().ref('players/' + fromId + "/faceit").set(
							data.items[0].player_id
						).then((result) => {
							this._sendMessageAfterDelay(dest, "I added your account "+data.items[0].nickname+" to my database.");
						})
						.catch((error) => {
							this._sendMessageAfterDelay(dest, "An error occured: " + error);
							this.chatBot.winston.error(error);
						});
						this._getAndSend(message, data.items[0].player_id);
					}
					else {
						this._sendMessageAfterDelay(dest, "I am having trouble finding your Faceit profile. Are you sure it exists?");
					}
				}).catch((error) => {
					this.chatBot.winston.error(error);
					this._sendMessageAfterDelay(dest, "An error occured: " + error);
				});
			}
		}).catch((error) => {
			this.chatBot.winston.error(error);
		});
			
		return true;
	}
	return false;
}