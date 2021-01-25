//Skeleton for new triggers
//-------------------------
var util = require("util");
//const Faceit = require("faceit-js");
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

// Check for any text match
FaceitTrigger.prototype._checkMessage = function(message, matches) {
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

FaceitTrigger.prototype._respond = function(toId, message, fromId) {
	var dest = toId;
	if(this.options.inPrivate) {
		dest=fromId;
	}
	message = message.split("?").join(":");
	if (!message) {
		return false;
	}
	
	var spl = message.toLowerCase().split(' ');
	if (this._checkMessage(spl[0], this.options.matches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			var ref = firebase.database().ref('entries/'+fromId).get()
			.then((val) => {
				if(typeof(val.faceit) !== 'undefined') {
					// Get Faceit info from database
					faceitid = val.faceit;
				}
				else {
					// Fetcb it using the faceit api
					this._sendMessageAfterDelay(dest, "I do not have your Faceit account in my database. Attempting to connect.");
					var faceitid;
					api.searchPlayer(fromId, 0, 1)
					.then((data) => {
						faceitid = data.items[0].player_id;
						// Store it in firebase
						firebase.database().ref('players/' + fromId).set({
							faceit : faceitid
						}).then((result) => {
							this._sendMessageAfterDelay(dest, "You have been added to the queue.");
						})
						.catch((error) => {
							console.error(error);
						});
					}).catch((error) => {
						console.error(error);
					});
				}
				
				if(typeof(faceitid !== 'undefined')) {
					api.players(faceitid, "", "")
					.then((d) => {
						var message = "Your Faceit stats:\r\n"
						+ "ELO: " + d.games.csgo.faceit_elo + " [Level " + d.games.csgo.skill_level + "]"
						+ (d.faceit_url).replace("{lang}", "en");
						this._sendMessageAfterDelay(dest, message);
					});
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