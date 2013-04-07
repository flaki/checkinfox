/*jshint browser: true, devel: true, strict: true, newcap: true, undef: true, curly: false, plusplus: false, laxcomma: true, laxbreak:true */
/*global define, mapbox, $ */

/*
check connection
var connection = window.navigator.mozConnection,
		online = "<strong>Connected:</strong> " + (connection.bandwidth),
*/

define("app",["require","when/when"], function(require,when) {
"use strict";

/* VanillaJS + jQuery */
window.$ = function(s) { return document.querySelector(s); };

/* Var definitions */
var apptitle=$("#apptitle");

var foursquare_auth=$("#foursquare-auth");
var foursquare_info=$("#foursquare-info");



/* Failure: Errors with defined type */
function Failure(type,message) {
	this.name = "Failure";
	this.type = type || "";
	this.message = message || "Failure";
}
Failure.prototype = new Error();
Failure.prototype.constructor = Failure;
Failure.prototype.toString = function () { return "["+this.type+" failure] "+this.message; };
Failure.prototype.fail = function (err) { if (!err && this instanceof Failure) err=this; alert(err.toString()); };
Failure.fail=Failure.prototype.fail;


var CLIENT={
	map:null

	,authorize:function(silent) {
		var deferred=when.defer();

		/* Fetch auth token & save */
		fetchAuthToken().then(
			function gotAuthToken(token) {
				/* Store token */
				FSAPI.token=token;
				console.debug("Auth token: "+token);

				/* Change window state to authenticated */
				$("#main").classList.add("authenticated");

				deferred.resolve(token);
			}

			/* No auth token - Ask user to log in/authorize (again) */
			,function tokenRequestFailed(err) {
				console.error(err);

				if (silent) return deferred.reject();

				if (err.type=="unauthorized") {
					alert("Please authorize FourSquare first, by clicking the 'Log In' button!");
					deferred.reject();

				/* Network error occured */
				} else throw err;
			}
		);

		return deferred.promise;
	}

	,showAuthUI:function() {
		var auth_url="http://www.flaki.hu/firefoxos/checkinfox/auth.php?client="+CLIENT.ID;
		var auth_window=window.open(auth_url);
			auth_window.addEventListener("close",function() {	window.console.debug("Auth window closed."); });

			/*TODO: use window.postMessage to close this */
	}
};

/* FourSquare utilities */
var FSUtil={
	checkinDate:function(d) {
		var now=new Date()
			,cd=new Date(d*1000)
			,timediff=(now-cd)/3600000-now.getHours()
			,datetext;

		if (timediff<0) {
			datetext="Today, ";
		} else if (timediff<24) {
			datetext="Yesterday, ";
		} else if (cd.getDay()<now.getDay&&cd.getDay()!==0) {
			datetext=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][cd.getDay()]+", ";
		} else {
			datetext=cd.getFullYear()+"."+cd.getMonth()+"."+cd.getDate()+", ";
		}
		datetext+=cd.getHours()+":"+(cd.getMinutes()<10?"0":"")+cd.getMinutes();

		return datetext;
	}
}; /*FSUtil*/

/* FourSquare API calls */
var FSAPI={
	/* API Access Token */
	token:null

	/* Authenticated user info */
	,user:null

	,call:function(endpoint,params) {
		var deferred=when.defer();
		var xhr = new XMLHttpRequest({mozSystem:true});
		var call="https://api.foursquare.com/v2";
		var method="GET";
		var i,l,result;

		/* Build call */
		i=0;
		if (endpoint[0]==="POST") { method="POST"; ++i; }

		for (l=endpoint.length;i<l;++i) {
			call+="/"+endpoint[i];
		}

		call+="?oauth_token="+FSAPI.token;
		call+="&v=20130410";

		if (method==="POST") {
			/* TODO: post calls */
		} else {
			for (i in params) call+="&"+i+"="+encodeURIComponent(params[i]);
		}
		console.log(call);

		/* Initiate api call */
		xhr.open(method, call, true);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (xhr.status === 200 && xhr.responseText) {
					try {
						var result=xhr.responseJSON || JSON.parse(xhr.responseText);
						if (!result) return deferred.reject(new Failure("json","JSON error or empty result!"));
						deferred.resolve(result);
					}
					catch (err) {
						return deferred.reject(new Failure("json","JSON.parse error: %s!",err));
					}
				} else {
					deferred.reject(new Failure("unauthorized","Unauthorized client! (HTTP/"+xhr.status+")"));
				}
			}
		}; /*onreadystatechange*/

		xhr.onerror = function () {
			deferred.reject(new Failure("xhr","FourSquare API call failed!"));
		};

		xhr.send();/* TODO: post data and additional headers */

		return deferred.promise;
	}

}; /*FSAPI*/

function appVisibility() {
	// Set the name of the hidden property and the change event for visibility
	var hidden, visibilityChange;
	if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
		hidden = "hidden";
		visibilityChange = "visibilitychange";
	} else if (typeof document.mozHidden !== "undefined") {
		hidden = "mozHidden";
		visibilityChange = "mozvisibilitychange";
	} else if (typeof document.msHidden !== "undefined") {
		hidden = "msHidden";
		visibilityChange = "msvisibilitychange";
	} else if (typeof document.webkitHidden !== "undefined") {
		hidden = "webkitHidden";
		visibilityChange = "webkitvisibilitychange";
	}

	// Warn if the browser doesn't support addEventListener or the Page Visibility API
	if (typeof document.addEventListener === "undefined" ||
		typeof hidden === "undefined") {
		alert("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.");

	// Handle page visibility change  
	} else {
		document.addEventListener(visibilityChange, function handleVisibilityChange() {
			if (document[hidden]) {
				console.log("app an background");//hidden
			} else {
				console.log("app reopened");//visible
			}
		}, false);

	}
} /*appVisibility*/

function fetchClientID() {
	function generate() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
			return v.toString(16);
		});
	}
	CLIENT.ID=localStorage.getItem("client");

	if (!CLIENT.ID)
		localStorage.setItem("client",CLIENT.ID=generate());

	return CLIENT.ID;
}

function fetchAuthToken(force_token_refresh) {
	/* Fetch client ID */
	fetchClientID();

	var deferred=when.defer();

	var xhr = new XMLHttpRequest({mozSystem:true});

	var url="http://www.flaki.hu/firefoxos/checkinfox/auth.php?"+(force_token_refresh?"refresh_":"")+"token&client="+CLIENT.ID;
	xhr.open("GET", url, true);
	console.debug(url);

	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) {
			/* Valid response */
			if (xhr.status === 200) {
				if (xhr.responseText) {
					deferred.resolve(xhr.responseText);
				} else {
					deferred.reject(new Failure("unauthorized","Unauthorized client."));
				}
			/* Request failed */
			} else {
				deferred.reject(new Failure("http","Auth Token request failed! (HTTP/"+xhr.status+")"));
			}
		}
	};/*onreadystatechange*/

	xhr.onerror = function () {
		deferred.reject(new Failure("xhr","XHR request failed!"));
	};

	xhr.send();

	return deferred.promise;
}


var GEOLOC={
	/* Current position */
	pos:null

	/* internal: Location watch id */
	,_watcher:null

	,coords: function() {
		if (!GEOLOC.pos) return null;

		var coords=GEOLOC.pos.coords;
		return coords.latitude+","+coords.longitude;
	}

	/* internal: Update position */
	,_updatePosition:function(position) {
		GEOLOC.pos=	position;
	}

	/* Init geolocation */
	,init:function() {
		var deferred=when.defer()
			,pos=null;

		navigator.geolocation.getCurrentPosition(
			/* Success */
			function (position) {
				console.debug("GEO: ",position.coords.latitude+","+position.coords.longitude);

				GEOLOC._updatePosition(position);
				deferred.resolve(GEOLOC.pos);
			}

			/* Failure */
			,function () {
				deferred.reject(new Failure("geo","Getting current location failed!"));
			}
		);

		return deferred.promise;
	}

	/* Follow geolocation changes */
	,follow:function() {
		GEOLOC._watcher=navigator.geolocation.watchPosition(
			/* Success */
			GEOLOC._updatePosition

			/* Failure */
			,function () {
				console.error("Failed to get GEOLocation on watch.");
			}
		,{ enableHighAccuracy:true, maximumAge:15000, timeout:13000 });
	}

	/* Suspend following geolocation changes */
	,stopFollowing:function () {}
}; /* GEOLOC */



/* TODO: refactor this to be using promises, and load only on-demand */
/* Login/Auth */
var loginButton = $("#foursquare-login");
if (loginButton) {
	loginButton.onclick = function () {
		CLIENT.showAuthUI();
	};
		
} else console.error("No login button present!");




/* TODO: Make sure to display map regardless of auth status */
function showMap(location) {
	var map_lat=location.coords.latitude
		 ,map_lon=location.coords.longitude;

	/* Create map */
	var map = mapbox.map('map');

	/* Map layer */
	map.addLayer(mapbox.layer().id('examples.map-vyofok3q'));
	/* Markers layer */
	var markerLayer = mapbox.markers.layer();

	/* Add marker feature */
	markerLayer.add_feature({
		geometry: { coordinates: [ map_lat,map_lon ] },
		properties: { }
	});

	/* Zoom and center on current location */
	map.centerzoom({lat:map_lat,lon:map_lon},8,false);
	map.centerzoom({lat:map_lat,lon:map_lon},17,true);

	CLIENT.map=map;
}


function init() {
	var deferred=when.defer();
	var initialize=function() {
		appVisibility();
		deferred.resolve();
	};

	/* DOM Content is ready */
	if (document.readyState === "complete" 
		|| document.readyState === "loaded" 
		|| document.readyState === "interactive")
	{
		initialize();

	/* Wait for DOM to be prepared */
	} else {
		document.addEventListener("DOMContentLoaded", initialize);
	}

	return deferred.promise;
}


try {
	/* [init]: Initialize */
	var init_flow=init();

	/* When [init] -> [auth]: Authenticate user */
	var auth_flow=init_flow

	/* Wait for document load & fetch auth token */
	.then(
		CLIENT.authorize
	)
	/* Request user info with the auth token that we got */
	.then(
		function () {
			/* Change window state to authenticated */
			$("#main").classList.add("authenticated");

			/* Check up on user info */
			return FSAPI.call(["users","self"]);
		}
	)
	/* Store and display user info */
	.then(
		function gotFSAPIUserInfo(res) {
			var user=res.response.user
				,checkin=user.checkins.items[0];

			/* Store user info */
			FSAPI.user=user;

			/* Update UI: authorized */
			apptitle.innerHTML="Welcome, "+FSAPI.user.lastName+"!";
			foursquare_info.innerHTML=FSUtil.checkinDate(checkin.createdAt)+" @ "+checkin.venue.name;
			foursquare_auth.style.display="none";
		}
		/* Failed */
		,function apiRequestFailed(err) {
			/* TODO: handle API errors */
			throw err;
		}

	);

	/* [geo]: Fire up geolocation */
	var geo_flow=GEOLOC.init();

	/* When [geo] -> Show location on map */
	geo_flow.then(function() {
		showMap(GEOLOC.pos);
	});

	/* When [auth] & [geo] -> [explore]: Show venue list & map */
	var explore_flow=when.join(auth_flow,geo_flow)

	/* User is authenticated and we have got a geolocation, check for recommended venues around current position */
	.then(
		function() {
			/* Request venues for venue list */
			var coords=GEOLOC.coords();
			var query={
				limit: 20
				,intent: "checkin"
			};
			if (coords) query.ll=coords;

			return FSAPI.call(['venues','search'],query);
		}
		,function apiRequestFailed(err) {
			/* TODO: handle API errors */
			throw err;
		}
	)

	/* List venues around current location */
	.then(
		function gotFSAPIVenues(res) {
			/* Parse results */
			var venues=res.response.venues
				,i,l=venues.length;

			/* Clear venuelist */
			var vlist=$("#venuelist");
				vlist.innerHTML="";

			/* Add venues */
			for (i=0;i<l;++i) {
				var vi=venues[i]
					,li=document.createElement("li");

					li.id="v_"+vi.id;
					li.innerHTML='<aside class="pack-end"><img alt="'+vi.categories[0].name+'" src="'+vi.categories[0].icon.prefix+'64'+vi.categories[0].icon.suffix+'"></aside>' +'<a href="#"><p>'+vi.name+' <strong></strong></p>' +'<p>'+vi.categories[0].name+'</p></a>';
				vlist.appendChild(li);
			}
		}
		,function apiRequestFailed(err) {
			/* TODO: handle API errors */
			throw err;
		}
	);

}

catch (err) {
	if (err instanceof Failure) err.fail(); else alert(err);
}

return {};

});