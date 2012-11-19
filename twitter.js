var VERSION = '0.0.2',
	querystring = require('querystring'),
	oauth = require('oauth');


var Twitter = function(options) {
	if (!(this instanceof Twitter))
		return new Twitter(options);

	this.consumerKey = options.consumerKey;
	this.consumerSecret = options.consumerSecret;
	this.callback = options.callback;

	this.oa = new oauth.OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
		this.consumerKey, this.consumerSecret, "1.0A", this.callback, "HMAC-SHA1");

	return this;
}
Twitter.VERSION = VERSION;

Twitter.prototype.getRequestToken = function(callback) {
	this.oa.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
		if (error) {
			callback(error);
		} else {  
			callback(null, oauthToken, oauthTokenSecret, results);
		}
	});
}

Twitter.prototype.getAccessToken = function(requestToken, requestTokenSecret, oauth_verifier, callback) {
	this.oa.getOAuthAccessToken(requestToken, requestTokenSecret, oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
		if (error) {
			callback(error);
		} else {
			callback(null, oauthAccessToken, oauthAccessTokenSecret, results);
		}
	});
}

Twitter.prototype.verifyCredentials = function(accessToken, accessTokenSecret, callback) {
	this.oa.get("https://api.twitter.com/1.1/account/verify_credentials.json", accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data));
		}	
	});	
}


// TIMELINES
Twitter.prototype.getTimeline = function(type, params, accessToken, accessTokenSecret, callback) {
	type = type.toLowerCase();

	var url;
	switch(type) {
		case "home_timeline":
		case "home":
			url = "home_timeline";
			break;
		case "mentions_timeline":
		case "mentions":
			url = "mentions_timeline";
			break;
		case "user_timeline":
		case "user":
			if (params.user_id || params.screen_name) {
				callback("Always specify either an user_id or screen_name when requesting a user timeline.");
				return false;
			}
			url = "user_timeline";
			break;
		case "retweets_of_me":
		case "retweets":
			url = "retweets_of_me";
			break;
		default:
			callback("Please specify an existing type.");
	}

	this.oa.get("https://api.twitter.com/1.1/statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data));
		}	
	});	
}

module.exports = Twitter;