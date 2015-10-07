"use strict";
var VERSION = "1.6.0",
	querystring = require("querystring"),
	oauth = require("oauth"),
	request = require("request"),
	fs = require("fs");

var baseUrl = "https://api.twitter.com/1.1/";
var uploadBaseUrl = "https://upload.twitter.com/1.1/";
var authUrl = "https://twitter.com/oauth/authenticate?oauth_token=";

var Twitter = function(options) {
	if (!(this instanceof Twitter))
		return new Twitter(options);

	this.consumerKey = options.consumerKey;
	this.consumerSecret = options.consumerSecret;
	this.callback = options.callback;

	this.oa = new oauth.OAuth("https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
		this.consumerKey, this.consumerSecret, "1.0A", this.callback, "HMAC-SHA1");

	return this;
};
Twitter.VERSION = VERSION;

Twitter.prototype.getRequestToken = function(callback) {
	this.oa.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results) {
		if (error) {
			callback(error);
		} else {
			callback(null, oauthToken, oauthTokenSecret, results);
		}
	});
};

Twitter.prototype.getAuthUrl = function(requestToken) {
	return authUrl + requestToken;
};

Twitter.prototype.getAccessToken = function(requestToken, requestTokenSecret, oauth_verifier, callback) {
	this.oa.getOAuthAccessToken(requestToken, requestTokenSecret, oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
		if (error) {
			callback(error);
		} else {
			callback(null, oauthAccessToken, oauthAccessTokenSecret, results);
		}
	});
};

Twitter.prototype.verifyCredentials = function(accessToken, accessTokenSecret, callback, params) {
	var url = baseUrl + "account/verify_credentials.json";
	if(params) {
		url += '?' + querystring.stringify(params);
	}
	this.oa.get(url, accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error);
		} else {
			try {
				callback(null, JSON.parse(data));
			} catch (e) {
				callback(e, data);
			}
		}
	});
};


// Timelines
Twitter.prototype.getTimeline = function(type, params, accessToken, accessTokenSecret, callback) {
	type = type.toLowerCase();

	var url;
	switch (type) {
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
			if (!params.user_id && !params.screen_name) {
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

	this.oa.get(baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error);
		} else {
			try {
				callback(null, JSON.parse(data));
			} catch (e) {
				callback(e, data);
			}
		}
	});
};

//Streaming
Twitter.prototype.getStream = function(type, params, accessToken, accessTokenSecret, dataCallback, endCallback) {
	type = type.toLowerCase();

	var url, method = "GET";
	switch (type) {
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
			var errorMessage = "Please specify an existing type.";
			dataCallback({message: errorMessage, e: new Error(errorMessage)}, null, null, null);
			return false;
	}

	var req;
	if (method == "GET") {
		req = this.oa.get(url + "?" + querystring.stringify(params), accessToken, accessTokenSecret);
	} else {
		req = this.oa.post(url, accessToken, accessTokenSecret, params, null);
	}
	var msg = [];
	req.addListener("response", function(res) {
		res.setEncoding("utf-8");
		res.addListener("data", function(chunk) {
			if (chunk == "\r\n") {
				dataCallback(null, {}, chunk, res);
				return;
			} else if (chunk.substr(chunk.length - 2) == "\r\n") {
				msg.push(chunk.substr(0, chunk.length - 2));
				var ret = msg.join("");
				msg = [];

				var parsedRet;
				try {
					parsedRet = JSON.parse(ret);
				} catch (e) {
					dataCallback({
						message: "Error while parsing Twitter-Response.",
						error: e
					}, null, chunk, res);
					return;
				}
				dataCallback(null, parsedRet, ret, res);
				return;
			} else {
				msg.push(chunk);
				return;
			}
		});
		res.addListener("end", function() {
			endCallback(res);
		});
	});
	req.end();

	return req;
};

// Tweets
Twitter.prototype.statuses = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET";
	switch (type) {
		case "retweets":
			url = "retweets/" + params.id;
			delete params.id;
			break;
		case "show":
			url = "show/" + params.id;
			delete params.id;
			break;
		case "lookup":
			url = "lookup";
			method = "POST";
			break;
		case "destroy":
			url = "destroy/" + params.id;
			delete params.id;
			method = "POST";
			break;
		case "update":
			method = "POST";
			break;
		case "retweet":
			url = "retweet/" + params.id;
			delete params.id;
			method = "POST";
			break;
		case "update_with_media":
			this.updateWithMedia(params, accessToken, accessTokenSecret, callback);
			return;
		default:
			callback("Please specify an existing type.");
			return false;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "statuses/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

Twitter.prototype.uploadMedia = function(params, accessToken, accessTokenSecret, callback) {
	var r = request.post({
		url: uploadBaseUrl + "media/upload.json",
		oauth: {
			consumer_key: this.consumerKey,
			consumer_secret: this.consumerSecret,
			token: accessToken,
			token_secret: accessTokenSecret
		}
	}, function(error, response, body) {
		if (error) {
			callback(error, body, response, uploadBaseUrl + "media/upload.json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(body), response);
			} catch (e) {
				callback(e, body, response);
			}
		}
	});

	var parameter = (params.isBase64) ? "media_data" : "media";

	// multipart/form-data
	var form = r.form();
	if (fs.existsSync(params.media)) {
		form.append(parameter, fs.createReadStream(params.media));
	} else {
		form.append(parameter, params.media);
	}
};

// Search
Twitter.prototype.search = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.get(baseUrl + "search/tweets.json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "search/tweets.json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Users
Twitter.prototype.users = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET"; // show, search, contributees, contributors
	if (url == "lookup") method = "POST";


	if (method == "GET") {
		this.oa.get(baseUrl + "users/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "users/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "users/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}

};


// Friends (similiar to Followers)
Twitter.prototype.friends = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list

	this.oa.get(baseUrl + "friends/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "friends/" + url + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Followers (similiar to Friends)
Twitter.prototype.followers = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list

	this.oa.get(baseUrl + "followers/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "folllowers/" + url + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Friendships
Twitter.prototype.friendships = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list
	var method = "GET";

	// define endpoints that use POST
	switch (type) {
		case "create":
		case "destroy":
		case "update":
			method = "POST";
	}


	if (method == "GET") {
		this.oa.get(baseUrl + "friendships/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "friendships/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "friendships/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

Twitter.prototype.updateProfileImage = function(params, accessToken, accessTokenSecret, callback) {

	if (!fs.existsSync(params["image"])) throw new Error("no image");

	var r = request.post({
		url: baseUrl + "account/update_profile_image.json",
		oauth: {
			consumer_key: this.consumerKey,
			consumer_secret: this.consumerSecret,
			token: accessToken,
			token_secret: accessTokenSecret
		}
	}, function(error, response, body) {
		if (error) {
			callback(error, body, response, baseUrl + "account/update_profile_image.json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(body), response);
			} catch (e) {
				callback(e, body, response);
			}
		}
	});

	// multipart/form-data
	var form = r.form();
	for (var key in params) {
		if (key != "image") {
			form.append(key, params[key]);
		}
	}

	form.append("image", fs.createReadStream(params["image"]));

};

// Account
Twitter.prototype.account = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "POST";
	switch (url) {
		case "settings":
			if (Object.keys(params).length === 0) {
				method = "GET";
			}
			break;
		case "verify_credentials":
			method = "GET";
			break;
		case "update_profile_image":
			this.updateProfileImage(params, accessToken, accessTokenSecret, callback);
			return;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "account/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "account/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "account/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Blocks
Twitter.prototype.blocks = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET";
	switch (url) {
		case "create":
		case "destroy":
			method = "POST";
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "blocks/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "blocks/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "blocks/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Mutes
Twitter.prototype.mutes = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET";
	switch (url) {
		case "users/create":
		case "users/destroy":
			method = "POST";
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "mutes/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
			callback(error, data, response, baseUrl + "mutes/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "mutes/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Users
Twitter.prototype.users = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "users/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "users/" + url + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Suggestions
Twitter.prototype.suggestions = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "suggestions":
		case "":
			url = "";
			break;
		case "members":
			url = params.slug + "/members";
			delete params.slug;
			break;
		case "slug":
			url = params.slug;
			delete params.slug;
			break;
	}

	this.oa.get(baseUrl + "users/suggestions" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "users/suggestions" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Favorites
Twitter.prototype.favorites = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "destroy":
		case "create":
			method = "POST";
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "favorites/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "favorites/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "favorites/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Direct Messages
Twitter.prototype.direct_messages = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";


	switch (url) {
		case "direct_messages":
		case "":
			url = "";
			break;
		case "destroy":
		case "new":
			method = "POST";
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "direct_messages" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "direct_messages" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "direct_messages/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Lists
Twitter.prototype.lists = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "members/destroy":
		case "members/destroy_all":
		case "members/create":
		case "members/create_all":
		case "subscribers/create":
		case "subscribers/destroy":
		case "destroy":
		case "update":
		case "create":
			method = "POST";
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "lists/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "lists/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "lists/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};


// Saved Searches
Twitter.prototype.savedSearches = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "create":
			method = "POST";
			break;
		case "show":
			url = "show/" + params.id;
			delete params.id;
			break;
		case "destroy":
			url = "destroy/" + params.id;
			delete params.id;
			method = "POST";
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "saved_searches/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "saved_searches/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "saved_searches/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Geo
Twitter.prototype.geo = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "place":
			method = "POST";
			break;
		case "id":
			url = "id/" + params.place_id;
			delete params.place_id;
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "geo/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "geo/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + "geo/" + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Trends
Twitter.prototype.trends = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "trends/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "trends/" + url + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Spam Reporting
Twitter.prototype.report_spam = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.post(baseUrl + "users/report_spam.json", accessToken, accessTokenSecret, params, function(error, data, response) {
		if (error) {
			callback(error, data, response);
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// OAuth
Twitter.prototype.oauth = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch (url) {
		case "access_token":
		case "request_token":
			method = "POST";
			url = "oauth/" + url;
			break;
		case "token":
		case "invalidate_token":
			method = "POST";
			url = "oauth2/" + url;
			break;
		default:
			url = "oauth/" + url;
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
			if (error) {
				callback(error, data, response, baseUrl + "geo/" + url + ".json?" + querystring.stringify(params));
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	} else {
		this.oa.post(baseUrl + url + ".json", accessToken, accessTokenSecret, params, function(error, data, response) {
			if (error) {
				callback(error, data, response);
			} else {
				try {
					callback(null, JSON.parse(data), response);
				} catch (e) {
					callback(e, data, response);
				}
			}
		});
	}
};

// Help
Twitter.prototype.help = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "help/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "help/" + url + ".json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

// Rate Limit Status
Twitter.prototype.rateLimitStatus = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.get(baseUrl + "application/rate_limit_status.json?" + querystring.stringify(params), accessToken, accessTokenSecret, function(error, data, response) {
		if (error) {
			callback(error, data, response, baseUrl + "application/rate_limit_status.json?" + querystring.stringify(params));
		} else {
			try {
				callback(null, JSON.parse(data), response);
			} catch (e) {
				callback(e, data, response);
			}
		}
	});
};

module.exports = Twitter;
