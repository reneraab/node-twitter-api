var VERSION = '0.0.4',
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
			if (!params.user_id || !params.screen_name) {
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
			return false;
	}

	this.oa.get("https://api.twitter.com/1.1/statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data));
		}	
	});	
}

//STREAMING
Twitter.prototype.getStream = function(type, params, accessToken, accessTokenSecret, dataCallback, endCallback) {
	type = type.toLowerCase();

	var url, method = "GET";
	switch(type) {
		case "userstream":
		case "user":
			url = "https://userstream.twitter.com/1.1/user.json";
			break;
		case "sitestream":
		case "site":
			url = "https://sitestream.twitter.com/1.1/site.json";
			break;
		case "sample":
			url = "https://stream.twitter.com/1.1/statuses/sample.json";
			break;
		case "firehose":
			url = "https://stream.twitter.com/1.1/statuses/firehose.json";
			break;
		case "filter":
			method = "POST";
			url = "https://stream.twitter.com/1.1/statuses/filter.json";
			break;
		default:
			callback("Please specify an existing type.");
	}

	var req;
	if (method == "GET") {
		req = this.oa.get(url + "?" + querystring.stringify(params), accessToken, accessTokenSecret);
	} else {
		req = this.oa.post(url, accessToken, accessTokenSecret, params, null);
	}
	req.addListener('response', function (res) {
		res.setEncoding('utf-8');
		res.addListener('data', function (chunk) {
			try {
				if (chunk == "") {
					dataCallback(null, {}, chunk, res);
				} else {
					dataCallback(null, JSON.parse(chunk), chunk, res);
				}
			} catch (e) {
				dataCallback({ message: "Error while parsing Twitter-Response.", error: e }, null, chunk, res);
			}
		});
		res.addListener('end', function() {
			endCallback();
		});
	});
	req.end();
}

// TWEETS
Twitter.prototype.statuses = function(type, params, accessToken, accessTokenSecret, callback) {
	type = type.toLowerCase();

	var url, method;
	switch(type) {
		case "destroy":
			url = "destroy/"+params.id;
			delete params.id;
			method = "POST";
			break;
		case "update":
			url = "update";
			method = "POST";
			break;
		case "show":
			url = "show/"+params.id;
			delete params.id;
			method = "GET";
			break;
		case "retweet":
			url = "retweet/"+params.id;
			delete params.id;
			method = "POST";
			break;
		default:
			callback("Please specify an existing type.");
			return false;
	}

	if (method == "GET") {
		this.oa.get("https://api.twitter.com/1.1/statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post("https://api.twitter.com/1.1/statuses/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	}
}

Twitter.prototype.retweet = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.post("https://api.twitter.com/1.1/statuses/retweet/" + params.id + ".json", accessToken, accessTokenSecret, {}, function (error, data, response) {
		if (error) {
			callback(error, response);
		} else {
		
			callback(null, JSON.parse(data), response);
		}	
	});
}

Twitter.prototype.undo_retweet = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.post("https://api.twitter.com/1.1/statuses/destroy/" + params.id + ".json", accessToken, accessTokenSecret, {}, function (error, data, response) {
		if (error) {
			callback(error, response);
		} else {
		
			callback(null, JSON.parse(data), response);
		}	
	});
}

Twitter.prototype.favorite = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.post("https://api.twitter.com/1.1/favorites/create.json", accessToken, accessTokenSecret, params, function (error, data, response) {
		if (error) {
			callback(error, response);
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
}

Twitter.prototype.undo_favorite = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.post("https://api.twitter.com/1.1/favorites/destroy.json", accessToken, accessTokenSecret, params, function (error, data, response) {
		if (error) {
			callback(error, response);
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
}

module.exports = Twitter;
