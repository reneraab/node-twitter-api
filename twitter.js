var VERSION = '1.1.1',
	querystring = require('querystring'),
	oauth = require('oauth');

var baseUrl = "https://api.twitter.com/1.1/";

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
	this.oa.get(baseUrl + "account/verify_credentials.json", accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data));
		}	
	});	
}


// Timelines
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

	this.oa.get(baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error);
		} else {
			callback(null, JSON.parse(data));
		}	
	});	
}

//Streaming
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
			return false;
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
				if (chunk == "\n") {
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

	return req;
}

// Tweets
Twitter.prototype.statuses = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET";
	switch(type) {
		case "retweets":
			url = "retweets/" + params.id;
			delete params.id;
			break;
		case "show":
			url = "show/"+params.id;
			delete params.id;
			break;
		case "destroy":
			url = "destroy/"+params.id;
			delete params.id;
			method = "POST";
			break;
		case "update":
			method = "POST";
			break;
		case "retweet":
			url = "retweet/"+params.id;
			delete params.id;
			method = "POST";
			break;
		case "update_with_media":
			method = "POST";
			break;
		default:
			callback("Please specify an existing type.");
			return false;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "statuses/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "statuses/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	}
}

// Search
Twitter.prototype.search = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.get(baseUrl + "search/tweets.json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "search/tweets.json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Users
Twitter.prototype.users = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET"; // show, search, contributees, contributors
	if (url == "lookup") method = "POST";


	if (method == "GET") {
		this.oa.get(baseUrl + "users/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "users/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "users/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}

};


// Friends (similiar to Followers)
Twitter.prototype.friends = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list

	this.oa.get(baseUrl + "friends/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "friends/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Followers (similiar to Friends)
Twitter.prototype.followers = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list

	this.oa.get(baseUrl + "followers/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "folllowers/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Friendships
Twitter.prototype.friendships = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase(); // ids or list
	var method = "GET";

	// define endpoints that use POST
	switch(type) {
		case "create":
		case "destroy":
		case "update":
			method = "POST";
	}


	if (method == "GET") {
		this.oa.get(baseUrl + "friendships/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "friendships/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "friendships/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Account
Twitter.prototype.account = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "POST";
	switch(url) {
		case "settings":
			if (Object.keys(params).length === 0) {
				method = "GET";
			}
			break;
		case "verify_credentials":
			method = "GET";
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "account/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "account/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "account/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Blocks
Twitter.prototype.blocks = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	var method = "GET";
	switch(url) {
		case "create":
		case "destroy":
			method = "POST";
			break;
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "blocks/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "blocks/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "blocks/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Users
Twitter.prototype.users = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "users/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "users/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Suggestions
Twitter.prototype.suggestions = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch(url) {
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

	this.oa.get(baseUrl + "users/suggestions" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "users/suggestions" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Favorites
Twitter.prototype.favorites = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch(url) {
		case "destroy":
		case "create":
			method = "POST";
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "favorites/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "favorites/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "favorites/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Direct Messages
Twitter.prototype.direct_messages = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";


	switch(url) {
		case "direct_messages":
		case "":
			url = "";
			break;
		case "destroy":
		case "new":
			method = "POST";
	}

	if (method == "GET") {
		this.oa.get(baseUrl + "direct_messages" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "direct_messages" + ((url) ? "/" + url : "") + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "direct_messages/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Lists
Twitter.prototype.lists = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();
	var method = "GET";

	switch(url) {
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
		this.oa.get(baseUrl + "lists/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "lists/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "lists/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
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
		this.oa.get(baseUrl + "saved_searches/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "saved_searches/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "saved_searches/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
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
		this.oa.get(baseUrl + "geo/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "geo/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + "geo/" + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Trends
Twitter.prototype.trends = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "trends/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "trends/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Spam Reporting
Twitter.prototype.report_spam = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.post(baseUrl + "users/report_spam.json", accessToken, accessTokenSecret, params, function (error, data, response) {
		if (error) {
			callback(error, response);
		} else {
			callback(null, JSON.parse(data), response);
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
		this.oa.get(baseUrl + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
			if (error) {
				callback(error, response, baseUrl + "geo/" + url + ".json?" + querystring.stringify(params));
			} else {
				callback(null, JSON.parse(data), response);
			}	
		});
	} else {
		this.oa.post(baseUrl + url + ".json", accessToken, accessTokenSecret, params, function (error, data, response) {
			if (error) {
				callback(error, response);
			} else {
				callback(null, JSON.parse(data), response);
			}
		});
	}
};

// Help
Twitter.prototype.help = function(type, params, accessToken, accessTokenSecret, callback) {
	var url = type.toLowerCase();

	this.oa.get(baseUrl + "help/" + url + ".json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "help/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

// Rate Limit Status
Twitter.prototype.rateLimitStatus = function(params, accessToken, accessTokenSecret, callback) {
	this.oa.get(baseUrl + "applications/rate_limit_status.json?" + querystring.stringify(params), accessToken, accessTokenSecret, function (error, data, response) {
		if (error) {
			callback(error, response, baseUrl + "help/" + url + ".json?" + querystring.stringify(params));
		} else {
			callback(null, JSON.parse(data), response);
		}	
	});
};

module.exports = Twitter;
