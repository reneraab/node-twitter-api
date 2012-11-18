# node-twitter #


Simple module for using Twitter's API in node.js

## Installation ##


`npm install node-twitter-api`

## Usage ##

### Step 1: Initialization ###
```javascript
var twitterAPI = require('node-twitter-api');
var twitter = new twitterAPI({
	consumerKey: 'your consumer Key',
	consumerSecret: 'your consumer secret',
	callback: 'http://yoururl.tld/something'
});
```
### Step 2: Getting a request token ###
```javascript
twitter.getRequestToken(function(error, requestToken, requestTokenSecret, results){
	if (error) {
		console.log("Error getting OAuth request token : " + error);
	} else {
		//store token and tokenSecret somewhere, you'll need them later; redirect user
	}
});
```
If no error has occured, you now have a `requestToken` and a `requestTokenSecret`. You should store them somewhere (e.g. in a session, if you are using express), because you will need them later to get the current user's access token, which is used for authentification.

### Step 3: Getting an Access Token ###
Redirect the user to `https://twitter.com/oauth/authenticate?oauth_token=[requestToken]`.
If he allows your app to access his data, Twitter will redirect him to your callback-URL (defined in Step 1) containing the get-parameters: `oauth_token` and `oauth_verifier`. You can use `oauth_token` (which is the `requestToken` in Step 2) to find the associated `requestTokenSecret`. You will need `requestToken`, `requestTokenSecret` and `oauth_verifier` to get an Access Token.
```javascript
twitter.getAccessToken(requestToken, requestTokenSecret, oauth_verifier, function(error, accessToken, accessTokenSecret, results) {
	if (error) {
		console.log(error);
	} else {
		//store accessToken and accessTokenSecret somewhere (associated to the user)
		//Step 4: Verify Credentials belongs here
	}
});
```
If no error occured, you now have an `accessToken` and an `accessTokenSecret`. You need them to authenticate later API-calls.

### Step 4: (Optional) Verify Credentials ###
```javascript
twitter.verifyCredentials(accessToken, accessTokenSecret, function(error, data, response) {
	if (error) {
		//something was wrong with either accessToken or accessTokenSecret
		//start over with Step 1
	} else {
		//accessToken and accessTokenSecret can now be used to make api-calls (not yet implemented)
		//data contains the user-data described in the official Twitter-API-docs
		//you could e.g. display his screen_name
		console.log(data["screen_name"]);
	}
});
```