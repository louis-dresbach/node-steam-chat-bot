//Skeleton for new triggers
//-------------------------
var util = require("util");
var when = require("when");
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

const matches = ["!queue", "!q"];
const rmatches = ['!unqueue', '!removequeue', '!uq', '!rq'];
const lmatches = ['!lobby', '!l'];
const lsmatches = ['!list', '!ls'];
const aumatches = ['!adduser', '!au'];

var strtotime = require('locutus/php/datetime/strtotime');

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
	if (!matches || matches.length === 0) {
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
	
	firebase.app();
	var spl = message.toLowerCase().split(' ');
	
	// !queue
	if (this._checkMessage(message, matches)) {
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			this._firebaseAuth(fromId, false).then((auth) => {
				this.chatBot.winston.debug("Adding user " + this._username(fromId) + " to queue.");
				var ref = firebase.database().ref('entries');
				ref.orderByChild("id").equalTo(fromId.getSteamID64()).once("value")
				.then((val) => {
					if(typeof(val.val()) !== 'undefined' && val.val() != null) {
						val.forEach((childSnapshot) => {
							var t = (new Date(childSnapshot.val().readytime * 1000)).toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});
							this._sendMessageAfterDelay(dest, "You are already queued from " + t + ".");
						});
					}
					else {
						var time = strtotime("20:00");
						if (spl.length > 1) {
							var parsed = strtotime(spl[1]);
							if (parsed !== false) {
								time = parsed;
							}
						}
						var now = Math.floor(Date.now() / 1000);
						if(time>now)
							strtotime("+1 day", time);
						ref.push({
							id: fromId.getSteamID64(),
							mode: "Faceit",
							readytime: time,
							time: now
						});
						this._sendMessageAfterDelay(dest, "You have been added to the queue.");
					}
				}).catch((error) => {
					this._sendMessageAfterDelay(dest, "An error occured: " + error);
					console.error(error);
				});
			}).catch((error) => {
				this._sendMessageAfterDelay(dest, "You are not authorized to use this command.");
				console.log(error);
			});
		})
		.catch((error) => {
			console.error(error);
		});
		return true;
	}
	
	// !unqueue
	if (this._checkMessage(message, rmatches)) {
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			this._firebaseAuth(fromId, false).then((auth) => {
				this.chatBot.winston.debug("Removing user " + this._username(fromId) + " from queue.");
				var ref = firebase.database().ref('entries');
				var p = ref.orderByChild("id").equalTo(fromId.getSteamID64()).once("value")
				.then((val) => {
					if(typeof(val.val()) !== 'undefined' && val.val() != null) {
						val.forEach((childSnapshot) => {
							console.log("Attempting to remove entry " + childSnapshot.key);
							ref.child(childSnapshot.key).remove()
							.then(() => {
								this._sendMessageAfterDelay(dest, "Removed your entry in the queue.");
							}).catch((error) => {
								this._sendMessageAfterDelay(dest, "An error occured: " + error);
								console.error(error);
							});
						});
					}
					else {
						this._sendMessageAfterDelay(dest, "You are not queued yet. Please use !queue to add yourself.");
					}
				}).catch((error) => {
					this._sendMessageAfterDelay(dest, "An error occured: " + error);
					console.error(error);
				});
			}).catch((error) => {
				this._sendMessageAfterDelay(dest, "You are not authorized to use this command.");
				console.log(error);
			});
		});
		
		return true;
	}
	
	// !lobby
	if (this._checkMessage(message, lmatches)) {
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			this._firebaseAuth(fromId, false).then((auth) => {
				this.chatBot.winston.debug("Showing lobbies to user " + this._username(fromId) + ".");
				
			}).catch((error) => {
				this._sendMessageAfterDelay(dest, "You are not authorized to use this command.");
				console.log(error);
			});
		}).catch((error) => {
			console.error(error);
		});
		
		return true;
	}
	
	// !list
	if (this._checkMessage(message, lsmatches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			this._firebaseAuth(fromId, false).then((auth) => {
				this.chatBot.winston.debug("Showing list of entries to user " + this._username(fromId) + ".");
				var ref = firebase.database().ref('entries').once("value")
				.then((val) => {
					if(typeof(val.val()) !== 'undefined' && val.val() != null) {
						var mes = "Current queue: \r\n";
						var i = 0;
						val.forEach((childSnapshot) => {
							i++;
							var t = (new Date(childSnapshot.val().readytime * 1000)).toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});
							mes += "  #" + i + " " + this._username(childSnapshot.val().id) + " [" + t + "]\r\n";
						});
						this._sendMessageAfterDelay(dest, mes);
					}
					else {
						this._sendMessageAfterDelay(dest, "There are currently no queues.");
					}
				}).catch((error) => {
					this._sendMessageAfterDelay(dest, "An error occured: " + error);
					console.error(error);
				});
			}).catch((error) => {
				this._sendMessageAfterDelay(dest, "You are not authorized to use this command.");
				console.log(error);
			});
		}).catch((error) => {
			console.error(error);
		});
		
		return true;
	}
	
	// !adduser
	if (this._checkMessage(message, aumatches)) {
		firebase.app();
		firebase.auth().signInWithEmailAndPassword(fusername, fpassword)
		.then((userCredential) => {
			this._firebaseAuth(fromId, true).then((auth) => {
				if (spl.length > 1) {
					var userId = spl[1];
					if (userId.length != 17) {
						this._sendMessageAfterDelay(dest, "Supplied Steam ID is invalid.");
					}
					else {
						var n = this._username(userId);
						this.chatBot.winston.debug("Adding user " + n + ".");
						firebase.database().ref('players/' + userId).update({
							name : n,
							role : "user"
						}).then((result) => {
							this._sendMessageAfterDelay(dest, "User " + n + " has been added.");
						})
						.catch((error) => {
							this._sendMessageAfterDelay(dest, "An error occured: " + error);
							console.error(error);
						});
					}
				}
				else {
					this._sendMessageAfterDelay(dest, "Please supply an user id like this:\r\n!adduser 76561198136709835");
				}
			}).catch((error) => {
				this._sendMessageAfterDelay(dest, "You are not authorized to use this command.");
				console.log(error);
			});
		}).catch((error) => {
			console.error(error);
		});
		
		return true;
	}
	
	return false;
}

LobbyTrigger.prototype._username = function(steamId) {
	if (this.chatBot.steamClient.users && steamId in this.chatBot.steamClient.users) {
		return this.chatBot.steamClient.users[steamId].player_name;
	}
	return steamId;
}