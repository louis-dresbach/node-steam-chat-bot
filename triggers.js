var adminUser = '76561198136709835'; 
var users = [];


module.exports = [
	// Commands to stop/unstop the bot from saying anything in a chatroom
	{ 
		name: 'MuteCommand', 
		type: 'BotCommandTrigger', 
		options: { 
			matches: ['!mute','stfu bot','bot, stfu','shut up, bot','bot, shut up'], 
			exact: true,
			callback: ["mute"] // calls ChatBot.mute()
		} 
	},
	{ 
		name: 'UnmuteCommand', 
		type: 'BotCommandTrigger', 
		options: { 
			matches: ['!unmute', '!unpause','wake up, bot','bot, wake up','wake up bot','bot wake up'], 
			exact: true,
			callback: ["unmute"] // calls ChatBot.unmute()
		} 
	},
	{ 
		name: 'RestartCommand', 
		type: 'BotCommandTrigger', 
		options: { 
			matches: ['!restart', '!r', '!reload'], 
			exact: true,
			users: [adminUser],
			callback: "restart" // calls ChatBot.restart()
		} 
	},

	{ name: 'SayTrigger',          type: 'SayTrigger',          options: { users: [adminUser] } },
	{ name: 'ModerateTrigger',     type: 'ModerateTrigger',     options: { users: [adminUser] } },
	{ name: 'BanTrigger',          type: 'BanTrigger',          options: { users: [adminUser] } },
	{ name: 'KickTrigger',         type: 'KickTrigger',         options: { users: [adminUser] } },
	{ name: 'UnbanTrigger',        type: 'UnbanTrigger',        options: { users: [adminUser] } },
	{ name: 'UnmoderateTrigger',   type: 'UnmoderateTrigger',   options: { users: [adminUser] } },
	{ name: 'UnlockChatTrigger',   type: 'UnlockChatTrigger',   options: { users: [adminUser] } },
	{ name: 'LockChatTrigger',     type: 'LockChatTrigger',     options: { users: [adminUser] } },
	{ name: 'LeaveChatTrigger',    type: 'LeaveChatTrigger',    options: { users: [adminUser] } },
	{ name: 'SetStatusTrigger',    type: 'SetStatusTrigger',    options: { users: [adminUser] } },
	{ name: 'SetNameTrigger',      type: 'SetNameTrigger',      options: { users: [adminUser] } },
	{ name: 'JoinChatTrigger',     type: 'JoinChatTrigger',     options: { users: [adminUser] } },
	{ name: 'RemoveFriendTrigger', type: 'RemoveFriendTrigger', options: { users: [adminUser] } },
	{ name: 'AddFriendTrigger',    type: 'AddFriendTrigger',    options: { users: [adminUser] } },
	
	{ name: 'LobbyTrigger', 	type: 'LobbyTrigger', options: {
		timeout: 1000
	} },
	
	{ name: 'FaceitTrigger', 	type: 'FaceitTrigger', options: {
		matches: ['!faceit', '!f'], 
		timeout: 1000
	} },
	
	{ name: 'MeTrigger', 	type: 'MeTrigger', options: {
		matches: ['!me'], 
		timeout: 1000
	} },

	// Informational commands
	{ name: 'HelpCmd',   type: 'ChatReplyTrigger', options: {
		matches: ['!help', '!triggers', '!cmds', '!commands', '!h'],
		responses: ['List of commands: \r\n!faceit - Shows your faceit stats.\r\n  !queue <time> - Adds you to the queue at your specified time. Defaults to 20:00.\r\n  !unqueue - Removes you from queue\r\n  !list - Shows all currently queued players.\r\n  !lobby - Shows my best solution to create lobbies.'],
		exact: true, probability: 1, timeout: 1000 } },

	// Automatically accept invites from any user to the specified group chat. I have reports that this may not currently work.
	{ 
		name: 'AcceptChatInvite', 
		type: 'AcceptChatInviteTrigger', 
		users: [adminUser],
		options: { 
			autoJoinAfterDisconnect: true
		} 
	},
	
	//steamrep command
	{	name: 'SteamIDCheck', 
		type: 'SteamrepTrigger', 
		options: { 
			command: "!steamrep", 
			delay: 2000, 
			timeout: 5*1000 } 
	}
];