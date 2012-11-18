var VERSION = '0.0.1',
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

Twitter.prototype.verifyCredentials = function (accessToken, accessTokenSecret, callback) {
	this.oa.get("https://api.twitter.com/1.1/account/verify_credentials.json", accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data), null);
		}	
	});	
}

module.exports = Twitter;