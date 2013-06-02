/*jshint browser: true, devel: true, strict: true, newcap: true, undef: true, curly: false, plusplus: false, laxcomma: true, laxbreak:true */
/*global define, $, L */

/*
check connection
var connection = window.navigator.mozConnection,
		online = "<strong>Connected:</strong> " + (connection.bandwidth),
*/

define("app",["require","when/when","when/timeout"], function(require,when,timeout) {
"use strict";

/* VanillaJS + jQuery */
window.$ = function(s) { return document.querySelector(s); };

/* Var definitions */
var apptitle=$("#apptitle");

var foursquare_auth=$("#foursquare-auth");
var foursquare_info=$("#foursquare-info");

var SCREENS={
	S:{
		'init': {l:0, scroll:0},
		'main': {l:1, scroll:0},
		'checkin': {l:2, scroll:0}, 'venue': {l:2, scroll:0}
	}

	,initButtons: function () {
		$("#foursquare-checkin").onclick=function() {
			SCREENS.activate("checkin"); return false;
		};
		$("#foursquare-venue").onclick=function() {
			SCREENS.activate("venue"); return false;
		};

		var bblist=document.querySelectorAll('a[role="button"][href="#"]')
			,l=bblist.length
			,bbfunc=function (e) {
				e.preventDefault();
				SCREENS.main(e);
				return false;
			};

		while (--l >= 0) bblist[l].addEventListener("click",bbfunc);
	}

	,main: function (src) {
		return SCREENS.activate('main');
	}
	,activate: function (toScreen) {
		var fromScreen='main',fs,ts=SCREENS.S[toScreen];
		if (typeof ts==="undefined") return false;

		/* Find current screen tag */
		var bodyclasses=document.body.classList;
		for (fromScreen in SCREENS.S) if (bodyclasses.contains("in-"+fromScreen)) break;

		/* Remove screen tag and fetch fromScreen meta properties */
		fs=SCREENS.S[fromScreen];
		bodyclasses.remove("in-"+fromScreen);

		/* Set new screen tag */
		document.body.classList.add("in-"+toScreen);

		/* On forward navigation store current scroll position and scroll to page top */
		if (fs.l<ts.l) {
			fs.scroll=window.scrollY;
			setTimeout(function () { window.scrollTo(0,0) }, 250);
			
		}	else {
			window.scrollTo(0,ts.scroll);
		}
		/* On backward navigation restore previous scroll position */

		return true;
	}
};

/* Failure: Errors with defined type */
function Failure(type,message) {
	this.name = "Failure";
	this.type = type || "";
	this.message = message || "Failure";
	console.debug(this.toString());
}
Failure.prototype = new Error();
Failure.prototype.constructor = Failure;
Failure.prototype.toString = function () { return "["+this.type+" failure] "+this.message; };
Failure.prototype.fail = function (err) { if (!err && this instanceof Failure) err=this; setTimeout(function(){ alert(err.toString()); },1); };
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

var WEBAPP={
	Install: function () {
		// Install app
		if (navigator.mozApps && navigator.mozApps.installPackage) {
			var checkIfInstalled = navigator.mozApps.getSelf();

			checkIfInstalled.onsuccess = function () {
				if (checkIfInstalled.result) {
					// Already installed

				} else {
					var install = $("#install"),
						manifestURL = location.href.substring(0, location.href.lastIndexOf("/")) + "/package.webapp";

					install.className = "show-install";
					install.onclick = function () {
						var installApp = navigator.mozApps.installPackage(manifestURL);

						installApp.onsuccess = function(data) { install.className=""; };
						installApp.onerror = function() { alert("Install failed: "+installApp.error.name); };
					};
				}/*CheckIfInstalled.result*/
			};

		/* Web application installation not supported */
		} else {
			console.log("Open Web Apps package installation not supported!");

		}
	}

	,Visibility: function () {
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
			(new Failure("This demo requires a browser, such as Google Chrome or Firefox, that supports the Page Visibility API.")).fail();

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
};/* WEBAPP */

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
	,onChangeHandlers:[]

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

			GEOLOC.locate({quick:true})
			.then(
				 deferred.resolve
				,function () { /* Fallback */
					GEOLOC.locate({fallback:true}).then(deferred.resolve,deferred.reject);
				}
			);

		return deferred.promise;
	}

	/* Get current geo */
	,LOCATE_QUICK_TIMEOUT:3000
	,LOCATE_FALLBACK_TIMEOUT:5000
	,locate:function(settings) {
		var deferred=when.defer()
			,P=deferred.promise
			,posobj={};

		/* Fallback method */
		if (settings.fallback) {
			var fallback_pos={ coords:{latitude:47,longitude:19} };

			/* Fallback XHR - get location by ip from online service */
			var xhr = new XMLHttpRequest({mozSystem:true});

			/* Set hard timeout on fallback API request, too */
			P=timeout(P,GEOLOC.LOCATE_FALLBACK_TIMEOUT);
			//P=timeout(P,1);

			xhr.ontimeout=function () {
				xhr.abort();
				//(new Failure("ui")).fail();  ,"Could not get your accurate position, fallback timed out. Check your GPS & connectivity settings, then tap the Refresh Location icon to try again!"
				deferred.reject(new Failure("xhr-timeout","Request timed out! (timeout value exceeded: "+xhr.timeout+"ms)"));
			};

			/* Initiate freegeoip API call */
			xhr.open("GET", "http://freegeoip.net/json/", true);
			xhr.timeout=GEOLOC.LOCATE_FALLBACK_TIMEOUT;

			xhr.onreadystatechange = function () {
				if (xhr.readyState === 4) {
					if (xhr.status === 200 && xhr.responseText) {
						try {
							var result=xhr.responseJSON || JSON.parse(xhr.responseText);
							if (!result) return deferred.reject(new Failure("json","JSON error or empty result!"));


							fallback_pos.coords.latitude=result.latitude;
							fallback_pos.coords.longitude=result.longitude;
							GEOLOC._updatePosition(fallback_pos);
							deferred.resolve(GEOLOC.pos);
							(new Failure("ui","Could not get your accurate position, fallback is used. Check your GPS settings, then tap the Refresh Location icon to try again!")).fail();
						}
						catch (err) {
							return deferred.reject(new Failure("json","JSON.parse error: %s!",err));
						}
					} else {
						deferred.reject(new Failure("xhr-http","Service error! (HTTP/"+xhr.status+")"));
					}
				}

			}; /*->onreadystatechange*/


			xhr.send();
			return P;
		}

		/* No geolocation support */
		if (!("geolocation" in navigator)) {
			deferred.reject(new Failure("unsupported","GEOLocation APU not supported!"));
			return P;
		}

		/* API request default settings */
		posobj.enableHighAccuracy=true;
		posobj.maximumAge=15000;

		/* Quick-response settings */
		if (settings.quick) {
			posobj.enableHighAccuracy=false;
			posobj.timeout=GEOLOC.LOCATE_QUICK_TIMEOUT;
			posobj.maximumAge=60000;

			/* Hard timeout on Quick geoloc */
			P=timeout(P,GEOLOC.LOCATE_QUICK_TIMEOUT);
		}

		GEOLOC._fetcher=navigator.geolocation.getCurrentPosition(
			function (position) { /* Success */
				console.debug("GEO: ",position.coords.latitude+","+position.coords.longitude);

				GEOLOC._updatePosition(position);
				deferred.resolve(GEOLOC.pos);
			}

			,function () { /* Failure */
				deferred.reject(new Failure("geo","Getting current location failed!"));
			}
			,posobj
		);

		if (settings.follow && typeof settings.follow === "function") {
			GEOLOC._watcher=navigator.geolocation.watchPosition(
				function (position) { /* Success */
					GEOLOC._updatePosition(position);
					settings.follow(true);
				}

				,function () { /* Failure */
					console.error("Failed to get GEOLocation on follow.");
					settings.follow(false);
				}
				,{ enableHighAccuracy:true, maximumAge:15000, timeout:13000 }
			);
			
		}/*if follow */
	
		return P;
	}

	/* Suspend following geolocation changes */
	,stopWatching:function () {}
}; /* GEOLOC */



/* TODO: refactor this to be using promises, and load only on-demand */
/* Login/Auth */
var loginButton = $("#foursquare-login");
if (loginButton) {
	loginButton.onclick = function () {
		CLIENT.showAuthUI(); return false;
	};
		
} else console.error("No login button present!");




function showLeafletMap(location) {
	var map_lat=location.coords.latitude
		 ,map_lon=location.coords.longitude;

	/* Create map */
	var map = L.map('mapdiv').setView([map_lat, map_lon], 7)
	,map_url='http://{s}.tile.cloudmade.com/e67291c638a141a29774d314befca457/{styleId}/256/{z}/{x}/{y}.png'
	,map_attr='&copy; ...';

	/* Add map tile layer */
	L.tileLayer(map_url, {attribution: map_attr, styleId: 997}).addTo(map);

	/* Estimated current location */
	var marker = L.marker([map_lat, map_lon]);
	marker.addTo(map);

	/* Location message */
		//marker.bindPopup("<b>Hello world!</b><br />I am a popup.").openPopup();

	CLIENT.map=map;
}


function init() {
	var deferred=when.defer();
	var initialize=function() {
		/* Init buttons */
		SCREENS.initButtons();

		/* Initialize webapp install */
		WEBAPP.Install();

		/* Set up visibility listeners */
		WEBAPP.Visibility();

		/* Initialization finished */
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
		//showMap(GEOLOC.pos);
		showLeafletMap(GEOLOC.pos);
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
				 li.innerHTML=(vi.categories.length
					? '<aside class="pack-end"><img alt="'+vi.categories[0].name+'" src="'+vi.categories[0].icon.prefix+'64'+vi.categories[0].icon.suffix+'"></aside>' +'<a href="#"><p>'+vi.name+' <strong></strong></p>' +'<p>'+vi.categories[0].name+'</p></a>'
					: '<p>'+vi.name+' <strong></strong></p>'
				);

				li.addEventListener("click",function(e){document.body.classList.add("in-venue");});

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