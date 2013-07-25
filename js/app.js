/*jshint browser: true, devel: true, strict: true, newcap: true, undef: true, curly: false, plusplus: false, laxcomma: true, laxbreak:true */
/*global define, $, L, MozActivity */

/*
check connection
var connection = window.navigator.mozConnection,
		online = "<strong>Connected:</strong> " + (connection.bandwidth),
*/

define("app",["require","when/when","when/timeout","when/delay"], function(require,when,timeout,delay) {
"use strict";


/* VanillaJS + jQuery */
window.$ = function(s) { return document.querySelector(s); };


/* Failure: Errors with defined type */
function Failure(type,message,payload) {
	this.name = "Failure";
	this.type = type || "";
	this.message = message || "Failure";

	// Additional payload or object
	if (payload) this.payload=payload;

	console.error(this.toString());
}
Failure.prototype = new Error();
Failure.prototype.constructor = Failure;
Failure.prototype.toString = function () { return "["+this.type+" failure] "+this.message; };

Failure.prototype.fail = function (err) {
	// Use this if err is not a Failure
	if (!err && this instanceof Failure) err=this;

	// Log to console
	console.error(err);

	// Display serious errors as a modal dialog
	if (err.type==="api" && err.payload) {
		UI.displayDialog("Error"
			,{
				icon:"images/error.png", label:"API request failed!", description: err.payload.code+" foursquare API error"
				,message: err.payload.errorDetail
			}
			,{
				buttons:[ { type:"danger", label:"OK", action:"retryCheckin" } ]
			}
		);
	
	// Display other errors as a failure notification
	} else if (err.payload && err.payload.name) {
		UI.displayNotification("["+err.payload.name+"]: "+err,null,"failure");
		
	} else {
		UI.displayNotification(err,null,"failure");

	}
};
Failure.fail=Failure.prototype.fail;



/* Shuffle elements - returns a random index between 0 and <elements>-1 */
/* while avoiding sending the same index again, if it was sent previously */
function Shuffle(elements) {
	var last=null;

	// Handle retrieving of last() generated element
	this.last=function () { return last; };


	// Handle next() w/ edge cases
	// Ideal case - return a randomized next index
	if (elements>2) {
		this.next=function () {
			var tries=10;
			var next;

			// 10 tries, try a random index
			while (--tries>=0) if ( (next=Math.floor(Math.random()*elements))!==last ) return (last=next);

			// fallback, return 0
			return 0;
		};

	// Two elements - alternate between these two
	} else if (elements==2) {
		this.next=function() { return 0+(!last); };

	// A single element - next always returns 0
	} else if (elements==1) {
		this.next=function() { return 0; };

	// No/invalid elements - next always returns null
	} else {
		this.next=function() { return null; };
	}
}




var UI={

	/* Set application titlebar */
	setTitle: function (title) {
		document.getElementById("apptitle").textContent=title;
	}

	/* Display a popup notification */
	,displayNotification: function (text,duration,settings) {
		var not=document.createElement("section"),contents=document.createElement("p");
			not.setAttribute("role","status");
			if (typeof settings==="string") not.className=settings;

			if (duration) not.style.animationDuration=duration+"s";
				contents.appendChild(document.createTextNode(text));
			not.appendChild(contents);

		/* Fade animation */
		not.addEventListener("animationend", function () {
			document.body.removeChild(not);
		}, false);

		document.body.appendChild(not);
	}


	/* Display a modal dialog box */
	,displayDialog: function (title,content,settings) {
		var eDialog=document.forms.dialogBox
			 ,eContent=document.createElement("section")
			 ,eMenu=document.createElement("menu");
		var i,l,e;


		// Title
		e=document.createElement("h1");
			e.textContent=title;
			eContent.appendChild(e);


		// Contents
		if (!content) content={};

		// HTML string contents
		if (typeof content==="string") {
			eContent.innerHTML=content;

		// Contents as a standard object definition
		} else {
			var p;

			// Progress throbber
			if (settings && settings.inprogress) {
				eContent.appendChild(document.createElement("progress"));
			}

			// Icon bar/content
			if (content.icon) {
				p=document.createElement("p");
					e=document.createElement("img");
						e.src=content.icon;
						e.alt=content.label || "icon";
					p.appendChild(e);

					if (content.label) {
						e=document.createElement("strong");
							e.textContent=content.label;
						p.appendChild(e);
					}

					if (content.description) {
						e=document.createElement("small");
							e.textContent=content.description;
						p.appendChild(e);
					}
				eContent.appendChild(p);
			}


			// Message
			if (content.message) {

				// Append string content
				if (typeof content.message==="string") {
					p=document.createElement("p");
						p.textContent=content.message;
					eContent.appendChild(p);

				// Rich HTML content
				} else {
					eContent.appendChild(content.message);
				}

			}
		}


		// In progress? Show progressbar
		if (settings && settings.inprogress) {
			eDialog.classList.add("inprogress");
		} else {
			eDialog.classList.remove("inprogress");
		}


		// Buttons
		eMenu.innerHTML="";
		if (settings && settings.buttons) {
			var but=settings.buttons; l=but.length; i=0;
			while (i<l) {
				var button=document.createElement("button");

				// Button text & style
				button.textContent=but[i].label;
				button.className=but[i].type;

				// Only one button -> span full width
				if (l==1) button.classList.add("full");

				// Executed action handler
				if (typeof but[i].action==="function") {

					// Inline handler function
					button.addEventListener("click",but[i].action);

				} else {

					// Action handler
					button.dataset.action=but[i].action;
					button.addEventListener("click",UI.handlerFunction);					
				}

				// Add to menu
				eMenu.appendChild(button);
				++i;
			}

		}

		// Add content & menu
		eDialog.innerHTML="";
		eDialog.appendChild(eContent);
		eDialog.appendChild(eMenu);

		// Switch app to modal/in-dialog mode
		document.body.classList.add("in-dialog");
	}
	,dismissDialog: function () {
		var eDialog=document.forms.dialogBox;

		// Turn off modal/in-dialog mode
		document.body.classList.remove("in-dialog");
	}

	,showHideFixedElements: function() {
		var wW=window.innerWidth
			 ,wH=window.innerHeight;

		// Hide main window fixed map when typing
		if (wH<300)
			document.body.classList.remove("showmap");
		else 
			document.body.classList.add("showmap");
	}


	/* UI click handlers */
	,handlers: {

		login: function(e) {
			CLIENT.showAuthUI();
		},
		logout: function(e) {
			localStorage.clear();
			WEBAPP.Restart();
		},

		toggleActive: function(e) {
			var target=e.currentTarget;
			target.classList.toggle("active");
		},

		about: function(e) {
			SCREENS.activate("about");
		},

		help: function(e) {
			SCREENS.activate("help");
		},

		geo: function(e) {},

		friends: function(e) {
			UI.displayNotification("This function is currently unavailable...",3);
			SCREENS.main();
		},

		profile: function(e) {
			UI.displayNotification("This function is currently unavailable...",3);
			SCREENS.main();
		},

		settings: function(e) {
			UI.displayNotification("This function is currently unavailable...",3);
			SCREENS.main();
		},

		/* Show clicked venue in the Venue sub-screen*/
		showVenue: function (e) {
			SCREENS.setup("venue",e.currentTarget.dataset);
			SCREENS.activate("venue");
		}

		/* Install application˛*/
		,installApp: function (e) {
			WEBAPP.Install();
		}

		/* Toggle fullscreen map */
		,toggleFullscreenMap: function (e) {	
			// Turn full screen map on/off
			document.body.classList.toggle("fullmap");

			// Recalculate container dimensions
			CLIENT.MAP.map.invalidateSize();
		}

		/* Open target of current element in a pop-up browser window view */
		,openWindow: function (e) {	
			var wnd=window.open(e.currentTarget.href);
			return wnd;
		}

		/* List & Search venues on main screen */
		,mainVenueList: function(e) {
			if (FSAPI.user) {
				var searchQuery=e.currentTarget.elements.searchQuery.value;

				// Clear venue list -> loading mode
				document.getElementById("venuelist").innerHTML="";

				apiQueryLocalVenues().then( updateVenueList );
			}

		}
		,mainVenueSearch: function(e) {
			if (FSAPI.user) {
				var searchQuery=e.currentTarget.elements.searchQuery.value;

				// Clear venue list -> loading mode
				document.getElementById("venuelist").innerHTML="";

				apiQuerySearchVenues(searchQuery).then( updateVenueList );
			}
		}

		/* Attach a photo to a check-in */
		,attachPhoto: function(e) {
			UI.handlers.removeAttachedPhoto(e);

			var pick = new MozActivity({
				name: "pick",
				data: {
					type: ["image/jpeg"]
				}
			});
			CLIENT.CHECKIN.photo=pick;

			// On successful pick, display image in the checkin dialog
			pick.onsuccess=function() {
				var res=pick.result
					,phImage=$("#attachPhotoPlaceholder>img")
					,phLabel=$("#attachPhotoPlaceholder>label");

				// Create object url for picked image
				CLIENT.CHECKIN.photoURL=window.URL.createObjectURL(res.blob);

				// Set up placeholder image and label
				phImage.className="";
				phImage.src=CLIENT.CHECKIN.photoURL;
				var title=(res.name ? res.name.split('/').pop() : "");
					phImage.alt=title;
					phLabel.textContent=title;

				// Show image placeholder
				phImage.parentNode.hidden=false;
			};
		}

		,removeAttachedPhoto: function(e) {
			if (!CLIENT.CHECKIN) return;

			// Remove photo properties from CHECKIN object
			if (CLIENT.CHECKIN.photo) delete CLIENT.CHECKIN.photo;

			if (CLIENT.CHECKIN.photoURL) {
				window.URL.revokeObjectURL(CLIENT.CHECKIN.photoURL);
				delete CLIENT.CHECKIN.photoURL;
			}

			// Hide placeholder & reset image tag
			$("#attachPhotoPlaceholder").hidden=true;
			$("#attachPhotoPlaceholder>img").className="";
		}

		/* Check in with a friend */
		,checkInAFriend: function(e) {
			FSAPI.call(["users","self","friends"]).then(function(res) { alert(res.response.friends.count+" friends"); });
		}

		/* Toggle sharing on Facebook/Twitter */
		,shareToggle: function(e) {
			var targetInput=e.currentTarget.form[e.currentTarget.dataset.input];
			if (targetInput) {
				targetInput.checked=!targetInput.checked;
			}
		}

		/* Finish checkin and return to main screen */
		,finishCheckin: function (e) {
			// Update last checkin
			updateLastCheckin(CLIENT.CHECKIN.result.response.checkin);

			// Main window
			SCREENS.main();

			// Dismiss dialog
			UI.dismissDialog();
		}

		/* A checkin has failed, close the dialog and let the user retry */
		,retryCheckin: function (e) {
			// Dismiss dialog
			UI.dismissDialog();
		}
		
		/* Publish the check-in */
		,publishCheckin: function (e) {
			var form=document.forms.publishCheckin
				,F=form.elements
				,checkin=CLIENT.CHECKIN;

			// Display check-in dialog
			UI.displayDialog("Checking in..."
				,null
				,{ inprogress:true }
			);

			/* Shout (optional) */
			if (F.shout.value) checkin.data.shout=F.shout.value;

			/* Broadcast/sharing */
			checkin.data.broadcast="public";
			if (F.shareFacebook.checked) checkin.data.broadcast+=",facebook";
			if (F.shareTwitter.checked) checkin.data.broadcast+=",twitter";

			// Attach a photo
			console.debug(checkin.photo);
			if (checkin.photo && checkin.photo.readyState==="done") {
				// Photodata API request vars are mostly the same as for the checkin
				checkin.photodata=new FormData();

				// Avoid double-posting broadcast
				checkin.photodata.append("broadcast",checkin.data.broadcast);
				checkin.data.broadcast="public";

				// Additional properties
				checkin.photodata.append("ll",checkin.data.ll);

				// Add contents 
				checkin.photodata.append("image",checkin.photo.result.blob);

				// Clean up unneeded photoURL
				window.URL.revokeObjectURL(checkin.photoURL);
			}

			// Publish checkin
			FSAPI.call(["POST","checkins","add"],checkin.data)
			.then(function(res) {
				checkin.result=res;
				console.debug(res);

			})

			// Attach photo to checkin
			.then(function() {
				if (checkin.photodata) {
					// Attach to last checkin
					checkin.photodata.append("checkinId",checkin.result.response.checkin.id);

					// API call
					return FSAPI.call(["POST","photos","add"],checkin.photodata);
				} else {
					return;
				}
			})

			.then(
				function(res) {
					var i,l,e;
					var R=checkin.result.response;
					var DLG={};

					// Photo checkin?
					if (res) {
						checkin.photoresult=res;
						console.debug(res);
					}

					// Dialog UI
					DLG.message=document.createElement("div");
					DLG.message.className="post-checkin";


					// Checkin venue info
					var checkinVenue=document.createElement("label")
						 ,checkinTime=document.createElement("time");

					checkinVenue.textContent=R.checkin.venue.name;
					checkinTime.textContent=FSUtil.checkinDate(R.checkin);

					DLG.message.appendChild(checkinVenue);
					//DLG.message.appendChild(checkinTime);


					// Checkin scores
					var checkinScores=document.createElement("ul")
						,checkinScore,checkinScoreIcon;
						checkinScores.className="scores";

					var sc=R.checkin.score.scores; l=sc.length; i=0;
					while (i<l) {
						checkinScore=document.createElement("li");
							checkinScore.textContent=sc[i].message;

							checkinScoreIcon=document.createElement("i");
							checkinScoreIcon.textContent="+"+sc[i].points;
							checkinScoreIcon.style.backgroundImage="url("+sc[i].icon+")";
						checkinScore.appendChild(checkinScoreIcon);

						checkinScores.appendChild(checkinScore);
						++i;
					}

					// Add scores to dialog
					DLG.message.appendChild(checkinScores);


					// Checkin has a photo
					if (res) {
						var checkinPhotoBox=document.createElement("div");

							// Add photo
							e=document.createElement("img");
								e.alt=R.checkin.venue.name;
								e.src=res.response.photo.prefix+"width300"+res.response.photo.suffix;
							checkinPhotoBox.appendChild(e);

							// Add photo label for shout
							if (R.checkin.shout) {
								e=document.createElement("label");
									e.textContent=R.checkin.shout;
								checkinPhotoBox.appendChild(e);
							}

							// Add photobox
							checkinPhotoBox.className="photobox";

							// Interactive click handler (zoom)
							checkinPhotoBox.dataset.action="toggleActive";
							checkinPhotoBox.addEventListener("click",UI.handlerFunction);

						DLG.message.appendChild(checkinPhotoBox);
					}

					// Update dialog
					UI.displayDialog("Got you in at:"
						,DLG
						,{
							buttons:[
								{ type:"recommend", label:"OK", action:"finishCheckin" }
							]
						}
					);

					// Display other notifications
					var nots=checkin.result.response.notifications;	i=0;
					while (i<nots.length) {
						if (nots[i].type==="message") {
							UI.displayNotification(nots[i].item.message,6);
						}
						++i;
					}

				}
				,function (err) {
					console.error(err);
					UI.displayNotification("Checkin failed!",null,"failure");

					var errorDescription=null, errorMessage=null;

					// API failure, "meta" object in payload contains additional info
					if (err && err.type==="api") {
						errorDescription=err.payload.code+" FourSquare API error";
						errorMessage=err.payload.errorDetail;

					// Some other error
					} else if (err) {
						errorDescription=err;
					}

					// Update dialog
					UI.displayDialog("Failed"
						,{
							icon:"images/error.png", label:"Checkin failed!", description:errorDescription
							,message: errorMessage
						}
						,{
							buttons:[
								{ type:"danger", label:"OK", action:"retryCheckin" }
							]
						}
					);
				}
			);
		}
			
	} /*end: handlers*/

	,handlerFunction: function(e) {
		var act=e.currentTarget.dataset.action || e.currentTarget.hash.substring(1);

		/* If a handler exists for this action, call it */
		if (UI.handlers[act]) {
			// Call handler
			UI.handlers[act](e);

			// If found a handler, stop propagating and remove default behavior
			e.stopPropagation();
			e.preventDefault();
			return false;
		}

		// Keep default behavior
		return true;
	}
};

var SCREENS={
	S:{
		'init': {l:0},
		'auth': {l:2},
		'main': {l:1,auth:true},
		'venue': {l:2, auth:true}, 'about': {l:2, auth:false}, 'help': {l:2, auth:false}
	}

	,initButtons: function () {
		var l;

		if ($("#foursquare-checkin")) $("#foursquare-checkin").onclick=function() {
			SCREENS.activate("checkin"); return false;
		};
		if ($("#foursquare-venue")) $("#foursquare-venue").onclick=function() {
			SCREENS.activate("venue"); return false;
		};

		/* (Back to) Main screen button(s) */
		var tBtns=document.querySelectorAll('button[data-target="#"], a[role="button"][href="#"]')
			,tBtnFunc=function (e) {
				e.preventDefault();
				SCREENS.main(e);
				return false;
			};

		l=tBtns.length;
		while ( --l >= 0)
			if (tBtns[l]) tBtns[l].addEventListener("click",tBtnFunc);

		/* Buttons with actions */
		var aBtns=document.querySelectorAll('[data-action], a[role="button"]:not([href="#"]), nav>ul>li>a[href]');

		l=aBtns.length;
		while ( --l >= 0)
			if (aBtns[l]) aBtns[l].addEventListener("click",UI.handlerFunction);

		// Venues filter on main page
		var mainVenueForm=document.forms.mainVenueSearch;
			mainVenueForm.addEventListener("submit",function(e) { e.preventDefault(); UI.handlers.mainVenueSearch(e); return false; });
			mainVenueForm.addEventListener("reset",function(e) { UI.handlers.mainVenueList(e); mainVenueForm.elements.searchQuery.focus(); });
			mainVenueForm.elements.clear.addEventListener("click",function (e) {
				return mainVenueForm.reset(e);
			});

	}

	,main: function (src) {
		// Authenticated - go (back) to main screen
		if (CLIENT.authenticated) {
			window.location.hash="";
			return SCREENS.activate('main');

		// Unauthenticated - show auth screen
		} else {
			window.location.hash="#auth";
			return SCREENS.activate('auth');
		}
	}

	,change: function (toScreen) {
		var fromScreen='main',fs,ts=SCREENS.S[toScreen];
		if (typeof ts==="undefined") return false;

		/* Find current screen tag */
		var bodyclasses=document.body.classList;
		for (fromScreen in SCREENS.S) if (bodyclasses.contains("in-"+fromScreen)) break;

		/* Remove screen tag and fetch fromScreen meta properties */
		fs=SCREENS.S[fromScreen];
		bodyclasses.remove("in-"+fromScreen);

		/* Set new screen tag */
		bodyclasses.add("in-"+toScreen);
		window.location.hash=toScreen;

		return true;
	}
	,activate: function (toScreen) {
		var bodyclasses=document.body.classList;


		// Change active screen
		if (!SCREENS.change(toScreen)) return false;


		/* Remove init/startup (if there is any) */
		if (bodyclasses.contains("init")) {
			bodyclasses.add("startup"); bodyclasses.remove("init");

		} else if (bodyclasses.contains("startup")) {
			bodyclasses.remove("startup");
		}

		return true;
	}

	// Start with page requested in url, if allowed, or load default fallback specified
	,start: function(fallback) {
		var auth=CLIENT.authenticated;
		var hash=window.location.hash.substr(1);

		// Hash is valid screen, that does not need authentication, or if it does, we are already authenticated
		if (hash in SCREENS.S && (auth||!SCREENS.S[hash].auth) ) {
			SCREENS.activate(hash);

		// Fallback to default
		} else {
			SCREENS.activate(fallback);
		}
	}

	,setup: function (screen,data) {
		/* Setup venue/checkin screen */
		if (screen==="venue") {
			var vid=data.venueId;
			if (typeof data.venueId==="undefined") { (new Failure('app','Invalid venue selected!')).fail(); return; }

			// Find venue in venuelist
			var V=FSAPI.venues && FSAPI.venues[vid];
			if (!V) { (new Failure('app','Requested venue not found!')).fail(); return; }

			// Reset form
			resetCheckinForm();

			/* Update venue information by fetching verbose venue details via FSQ API */
			FSAPI.currentVenue=V;

			/* TODO: put API calls to separate thread, use delay here to avoid API call interfering with layout animation */
			delay(600,['venues',V.id]).then( FSAPI.call )

			.then( function (res) {

				var CV=FSAPI.currentVenue=res.response.venue
					,venuePhotoDisplay=$("#venue ul.photos");

				/* Store checkin venue info */
				CLIENT.CHECKIN={
					venue: CV
					,data: { venueId: CV.id, ll: GEOLOC.coords() }
				};

				// Update external foursquare link
				var ext=$("#venue a[data-action=\"openWindow\"]");
				ext.href=CV.canonicalUrl.replace("foursquare.com/","foursquare.com/touch/");

				// Enable check-in button
				$("#venue button[data-action=\"publishCheckin\"]").disabled=false;

				/* Update screen with venue photo */
				if (CV.photos.groups.length>0 && CV.photos.groups[0].items.length>0) {
					var venuePhotoItemCount=CV.photos.groups[0].items.length
						,venuePhotoItems=CV.photos.groups[0].items;

					var i,p;
					for (i=0; i<venuePhotoItemCount && i<9; ++i) {
						p=document.createElement('li');
							p.style.backgroundImage="url("+venuePhotoItems[i].prefix+"width300"+venuePhotoItems[i].suffix+")";
						venuePhotoDisplay.appendChild(p);
					}
				}

				// Show a random photo
				var vpd=venuePhotoDisplay.children;
				var nextP=new Shuffle(vpd.length)
					,lastP=nextP.next();
				vpd[ lastP ].classList.add("show");

				// Remove previous "slider"
				if (CLIENT.CHECKIN.photoCycle) {
					clearInterval(CLIENT.CHECKIN.photoCycle);
					CLIENT.CHECKIN.photoCycle=null;
				}

				// Cycle photos
				var photoCycle=CLIENT.CHECKIN.photoCycle=setInterval(function () {
					var P;

					// Removed
					if (CLIENT.CHECKIN.photoCycle!==photoCycle || !document.body.classList.contains("in-venue")) {
						clearInterval(photoCycle);
						photoCycle=null;
						return;
					}

					// New random photo
					P=nextP.next();

					// Show/hide selected
					vpd[ lastP ].classList.remove("show");
					vpd[ P ].classList.add("show");
					lastP=P;

				},5000);

			});

			/* Reset instance */
			var e=$("#venue ul.photos");
			while (e.lastChild) e.removeChild(e.lastChild); /* remove photos */

			/* Update screen title */
			$("#venue header>.screentitle").textContent=V.name;
		}

	}
};


var CLIENT={
	// Auth state
	authenticated: false

	// Leaflet map instance
	,map: null


	/* Store key needed for fetching the auth token - single use token only */
	,saveTokenRequestKey: function(key) {
		localStorage.setItem("token_request_key",key);
		return key;
	}
	,loadTokenRequestKey: function() {
		var key=localStorage.getItem("token_request_key");
			localStorage.removeItem("token_request_key");
		return key;
	}

	/* Store and retrieve auth token */
	,saveAuthToken: function(token) {
		localStorage.setItem("api_access_token",token);
		return token;
	}
	,loadAuthToken: function() {
		return localStorage.getItem("api_access_token");
	}

	,fetchClientID: function () {
		CLIENT.ID=localStorage.getItem("client");

		if (!CLIENT.ID) {
			localStorage.setItem(
				"client"
				,CLIENT.ID=(function() {
					return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
						var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
						return v.toString(16);
					});
				})()
			);
		}

		return CLIENT.ID;
	}

	,fetchAuthToken: function (force_token_refresh) {
		var deferred=when.defer();

		// Use stored auth token
		if (!force_token_refresh) {
			var auth_token=CLIENT.loadAuthToken();
			if (auth_token) {
				deferred.resolve(auth_token);
				return deferred.promise;
			}
		}

		// Token request needs a key
		var tokenRequestKey=CLIENT.loadTokenRequestKey();
		if (!tokenRequestKey) {
			deferred.reject(new Failure("no-token-key","Missing token request key! Please reauthorize with foursquare."));
			return deferred.promise;
		}

		//var xhr = new XMLHttpRequest({mozSystem:true});
		var xhr = new XMLHttpRequest();

		var url="https://checkinfox-flaki.rhcloud.com/auth?client_id="+CLIENT.fetchClientID()+"&token="+tokenRequestKey;
		xhr.open("GET", url, true);
		console.debug(url);

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				/* Valid response */
				if (xhr.status === 200) {
					if (xhr.responseText) {
						deferred.resolve(CLIENT.saveAuthToken(JSON.parse(xhr.responseText).access_token));
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


	,authorize: function (silent) {
		var deferred=when.defer();

		/* Fetch auth token & save */
		CLIENT.fetchAuthToken().then(
			function gotAuthToken(token) {
				/* Store token */
				FSAPI.token=token;
				console.debug("Auth token: "+token);

				/* Change window state to authenticated */
				CLIENT.authenticated=true;
				document.body.classList.add("authenticated");

				deferred.resolve(token);
			}

			/* No auth token - Ask user to log in/authorize (again) */
			,function tokenRequestFailed(err) {
				console.error(err.toString(),err);

				// Silent reject
				if (silent) return deferred.reject(err);

				if (err.type=="unauthorized" || err.type=="no-token-key") {
					UI.displayNotification("Please authorize FourSquare first, by clicking the 'Log In' button!");
					deferred.reject(err);

				/* Network error occured */
				} else throw err;
			}
		);

		return deferred.promise;
	}

	,showAuthUI:function() {
		var auth_host="https://checkinfox-flaki.rhcloud.com";
		var auth_url=auth_host+"/auth?client_id="+CLIENT.fetchClientID();
		var auth_window=window.open(auth_url);
			auth_window.postMessage("Check-in Fox Authentication", auth_host);


		var callbackListener=window.addEventListener("message", function(e) {
			if (e.origin===auth_host) {
				CLIENT.saveTokenRequestKey(e.data);
				WEBAPP.Restart();
			}
		}, false);
	}
};

/* FourSquare utilities */
var FSUtil={
	checkinDate: function (obj) {
		var cd= (typeof obj==="object" && obj.createdAt) ? FSUtil.getDate(obj) : new Date(obj*1000);

		var now=new Date()
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

	,getTimestamp: function (obj) {
		if (!(typeof obj==="object" && obj.createdAt)) return;

		return obj.createdAt;
	}
	,getDate: function(obj) {
		if (!(typeof obj==="object" && obj.createdAt)) return;

		return new Date( obj.createdAt );
	}
	,getMinutes: function (obj) {
		if (!(typeof obj==="object" && obj.createdAt)) return;

		return Math.floor((obj.createdAt-Date.now()/1000)/60);
	}

}; /*FSUtil*/

/* FourSquare API calls */
var FSAPI={
	/* API Access Token */
	token:null

	/* Authenticated user info */
	,user:null

	/* Venue info from last query */
	,venues:null


	,call: function (endpoint,params) {
		var deferred=when.defer();
		//var xhr = new XMLHttpRequest({mozSystem:true});
		var xhr = new XMLHttpRequest();
		var call="https://api.foursquare.com/v2"
			,method="GET"
			,postdata="";
		var i,l,result;

		/* Build call */
		i=0;
		if (endpoint[0]==="POST") {
			method="POST"; ++i;
		}

		for (l=endpoint.length;i<l;++i) {
			call+="/"+endpoint[i];
		}

		call+="?oauth_token="+FSAPI.token;
		call+="&v=20130410";

		// Params include the POSTed data
		if (method==="POST") {
			// FormData format
			if (params instanceof FormData) {
				postdata=params;

			// Standard object format
			} else {
				for (i in params) if (params.hasOwnProperty(i)) {
					postdata+=(postdata===""?"":"&")+i+"="+encodeURIComponent(params[i]);
				}
			}

		// Params specify additional GET parameters
		} else {
			for (i in params) if (params.hasOwnProperty(i)) {
				call+="&"+i+"="+encodeURIComponent(params[i]);
			}
		}
		console.debug(method,call,postdata);

		/* Initiate api call */
		xhr.open(method, call, true);

		// Set POST Content-type header for standard form input
		if (method==="POST" && !(postdata instanceof FormData)) {
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		}

		xhr.onreadystatechange = function () {
			// Wait until the request is completed
			if (xhr.readyState === 4) {
				var result;

				// Empty response
				if (!xhr.responseText) {
					return deferred.reject(new Failure("xhr","Empty response received (HTTP/"+xhr.status+")"));
				}

				// Try parsing response and getting a JSON representation of the api response
				try {	result=xhr.responseJSON || JSON.parse(xhr.responseText); }
				catch (err) {
					return deferred.reject(new Failure("json","JSON.parse error: "+err));
				}

				// Success
				if (xhr.status === 200) {
					deferred.resolve(result);
				} else {
					deferred.reject(new Failure("api","API error (HTTP/"+xhr.status+")",result && result.meta));
				}
			}
		}; /*onreadystatechange*/

		xhr.onerror = function () {
			deferred.reject(new Failure("xhr","FourSquare API XMLHttpRequest failed!"));
		};

		xhr.send( method==="POST" ? postdata : null );

		return deferred.promise;
	}

}; /*FSAPI*/


var WEBAPP={
	Restart: function () {
		window.location.hash="";
		window.location.reload(true);
	}

	,installSupported: function () {
		return (navigator.mozApps && navigator.mozApps.installPackage);
	}

	,installed: function () {
		var deferred=when.defer();

		// Webapp installs are not supported
		if (!WEBAPP.installSupported()) return deferred.reject();

		// Check if already installed
		var checkIfInstalled = navigator.mozApps.getSelf();

		checkIfInstalled.onsuccess = function () {
			// Installed
			if (checkIfInstalled.result) {
				deferred.resolve();

			// Not installed
			} else {
				deferred.reject();
			}
		};

		return deferred.promise;
	}

	,Install: function () {
		var deferred=when.defer();

		WEBAPP.installed().then(
			// Installed already
			function () {
				deferred.reject();

				return (new Failure("install","App is already installed!")).fail();
			}

			// Try and install application
			,function () {
				var installApp = navigator.mozApps.installPackage("https://checkinfox-flaki.rhcloud.com/package.manifest");

				// Install succeeded
				installApp.onsuccess = function(data) {
					deferred.resolve(data);

					UI.displayNotification("Check-in Fox installed!");
				};

				// Install failed
				installApp.onerror = function() {
					deferred.reject();

					return (new Failure("install","App installation failed!",installApp.error)).fail();
				};

			}
		);

		return deferred.promise;
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
					//console.log("App in background");//hidden
				} else {
					//console.log("App reopened");//visible
				}
			}, false);

		}
	} /*appVisibility*/

	/* Offline mode */
	,Offline: function () {
		var appCache=window.applicationCache;

		// Handle AppCache changes
		if (appCache) {

			// App updates
			appCache.onupdateready = function () {
				if (confirm("The app has been updated. Do you want to download the latest files? \nOtherwise they will be updated at the next reload.")) {
					WEBAPP.Restart();
				}
			};

			// Offline state
			appCache.onerror = function() {
				UI.displayDialog("Offline","Your device seems to be offline.",{
					buttons:[ { type:"danger", label:"OK", action:function () { UI.dismissDialog(); } } ]
				});
			};

		}
	} /*appOffline*/

};/* WEBAPP */



var GEOLOC={
	/* Current position */
	pos: null
	,approx: null
	,near: null
	,onChangeHandlers: []

	,LOCATE_GEOIP_TIMEOUT: 5000
	,LOCATE_GPS_QUICK_TIMEOUT: 2000
	,LOCATE_GPS_TIMEOUT:       5000

	/* internal: Location watch id */
	,_watcher:null

	,coords: function() {
		var pos=GEOLOC.pos || GEOLOC.approx;
		if (!pos) return null;

		return pos.coords.latitude+","+pos.coords.longitude;
	}

	/* Init geolocation */
	,init: function() {
		// Add geolocation state button handler
		var stateElement=document.getElementById("GEOLOC");
		if (stateElement) stateElement.addEventListener("click",function() {
			GEOLOC.setState("searching");
			UI.displayNotification("Updating geolocation...",3); 

			setTimeout(function() {
				var geo=GEOLOC.followLocation(onLocationUpdated);

				// If authenticated, update venue list
				if (FSAPI.user) geo.then(function() {
					UI.displayNotification("Fetching local venues...",3); 

					apiQueryLocalVenues().then(updateVenueList);
				});
			});
		});

		// Fetch initial location
		return GEOLOC.getLocation("quick");
	}

	,setState: function(newState) {
		var stateElement=document.getElementById("GEOLOC");

		if (stateElement) {
			stateElement.dataset.state=newState;
		}
	}

	/* Get user location */
	,getLocation: function(quick) {
		var gps,geoip;
		var providers=[];

		// Searching for location
		GEOLOC.setState("searching");

		/* Fetch an approximate location using geoIP location */
		if (!GEOLOC.approx) {
			geoip=GEOLOC.locateGeoIP();

			geoip.then(
				function(position) {
					GEOLOC.approx=position;
				}
				,Failure.fail
			);

			providers.push(geoip);
		}


		/* Try to get a GPS fix and an accurate location for the user */
		var locateSettings={};
		if (!quick) { //locateSettings.quick=true;

			gps=GEOLOC.locate(locateSettings);
			gps.then(
				function (position) {
					GEOLOC.pos=position;

					// Got accurate position
					GEOLOC.setState("lock");
				}
				,Failure.fail
			);

			providers.push(geoip);
		}

		return providers ? when.any(providers) : null;
	}

	/* Follow user location */
	,followLocation: function(callback,timeout) {
		var gps;

		// Searching for location
		GEOLOC.setState("searching");

		/* GPS call setup */
		var locateSettings={};
		locateSettings.follow=function (position) { GEOLOC.pos=position; callback.call(position); };
		locateSettings.timeout=timeout || GEOLOC.LOCATE_GPS_TIMEOUT;

		gps=GEOLOC.locate(locateSettings);
		gps.then(function (position) {
			GEOLOC.pos=position;

			// Got accurate position
			GEOLOC.setState("lock");
		},Failure.fail);

		return gps;
	}

	/* Get an approximate location via GeoIP location */
	,locateGeoIP: function() {
		var deferred=when.defer()
			,P=deferred.promise;

		/* Fallback XHR - get location by ip from online service */
		//var xhr = new XMLHttpRequest({mozSystem:true});
		var xhr = new XMLHttpRequest();

		/* Set hard timeout on fallback API request, too */
		P=timeout(P,GEOLOC.LOCATE_GEOIP_TIMEOUT);

		xhr.ontimeout=function () {
			xhr.abort();
			//(new Failure("ui")).fail();  ,"Could not get your accurate position, fallback timed out. Check your GPS & connectivity settings, then tap the Refresh Location icon to try again!"
			deferred.reject(new Failure("xhr-timeout","Request timed out! (timeout value exceeded: "+xhr.timeout+"ms)"));
		};

		/* Initiate freegeoip API call */
		xhr.open("GET", "http://freegeoip.net/json/", true);
		xhr.timeout=GEOLOC.LOCATE_GEOIP_TIMEOUT;

		xhr.onreadystatechange = function () {
			if (xhr.readyState === 4) {
				if (xhr.status === 200 && xhr.responseText) {
					try {
						var result=xhr.responseJSON || JSON.parse(xhr.responseText);
						if (!result) return deferred.reject(new Failure("json","JSON error or empty result!"));

						// "Near" geocode usable in search queries
						GEOLOC.near=result.city+", "+result.country_code;

						UI.displayNotification("You are in "+result.city+", "+result.country_name,2);
						deferred.resolve({coords:{latitude:result.latitude,longitude:result.longitude}});
					}
					catch (err) {
						return deferred.reject(new Failure("json","JSON.parse error: "+err));
					}
				} else {
					deferred.reject(new Failure("xhr-http","Service error! (HTTP/"+xhr.status+")"));
				}
			}
		}; /*->onreadystatechange*/

		xhr.send();
		return P;
	}

	/* Get current geo */
	,locate: function(settings) {
		var deferred=when.defer()
			,P=deferred.promise
			,posobj={};
		var locateTimeout=(settings && settings.timeout ? timeout : GEOLOC.LOCATE_GEOIP_TIMEOUT);


		/* No geolocation support */
		if (!("geolocation" in navigator)) {
			deferred.reject(new Failure("unsupported","GEOLocation API not supported!"));
			return P;
		}

		/* API request default settings */
		posobj.enableHighAccuracy=true;
		posobj.maximumAge=15000;
		posobj.timeout=locateTimeout;

		/* Quick-response settings */
		if (settings && settings.quick) {
			posobj.enableHighAccuracy=false;
			posobj.timeout=GEOLOC.LOCATE_GPS_QUICK_TIMEOUT;
			posobj.maximumAge=300000;

			// Hard timeout on Quick geoloc
			P=timeout(P,GEOLOC.LOCATE_GPS_QUICK_TIMEOUT);
		} else {
			// Hard timeout for normal geoloc on the returned promise
			P=timeout(P,GEOLOC.LOCATE_GPS_TIMEOUT);
		}

		// Get position
		GEOLOC._fetcher=navigator.geolocation.getCurrentPosition(
			function (position) { /* Success */
				console.debug("GEO: ["+position.coords.latitude+","+position.coords.longitude+"]");

				deferred.resolve(position);
			}

			,function () { /* Failure */
				deferred.reject(new Failure("geo","Getting current location failed!"));
			}
			,posobj
		);

		if (settings.follow && typeof settings.follow === "function") {

			// Start only after getCurrentPosition succeeded (on original deferred, with no timeout)
			when(deferred.promise,function() {
				// Clear old watch
				if (GEOLOC._watcher) {
					navigator.geolocation.clearWatch(GEOLOC._watcher);
				}

				// Add new watcher and callbacks
				GEOLOC._watcher=navigator.geolocation.watchPosition(
					function (position) { /* Success */
						console.debug("GEO: ["+position.coords.latitude+","+position.coords.longitude+"] [follow]");

						// Have accurate position
						GEOLOC.setState("lock");

						// Call callback with position
						settings.follow(position);
					}

					,function () { /* Failure */
						console.error("Failed to get GEOLocation on follow.");
						settings.follow(false);
					}
					,{ enableHighAccuracy:true, maximumAge:15000, timeout:locateTimeout }
				);
			});
			
		}/*if follow */
	
		return P;
	}

	/* Suspend following geolocation changes */
	,stopWatching:function () {}
}; /* GEOLOC */



CLIENT.MAP={
	map: null

	,show: function() {
		/* Location data */
		var location=GEOLOC.pos || GEOLOC.approx
			,map_lat=location.coords.latitude
			,map_lon=location.coords.longitude
			,map_acc=(GEOLOC.pos ? true : false);

		/* Create map */
		if (!CLIENT.MAP.map) {
			var map = L.map('mapdiv')
				,map_url='http://{s}.tile.cloudmade.com/e67291c638a141a29774d314befca457/{styleId}/256/{z}/{x}/{y}.png';

			/* Add map tile layer */
			L.tileLayer(map_url, {attribution: null, styleId: 997}).addTo(map);

			/* Add a marker */
			var marker = L.marker([map_lat, map_lon]);

			/* Disable map interactions */
			//map.dragging.disable();
			//map.touchZoom.disable();
			map.doubleClickZoom.disable();
			map.scrollWheelZoom.disable();
			map.boxZoom.disable();
			map.keyboard.disable();

			/* Save created map to API namespace and initialize viewport */
			CLIENT.MAP.map=map;
			CLIENT.MAP.marker=marker;
		}

		/* Update map viewport */
		CLIENT.MAP.updateViewport();
	}

	,updateViewport: function(nofollow) {
		var map=CLIENT.MAP.map;
		var location=GEOLOC.pos || GEOLOC.approx;
		if (!map || !location) return;

		/* Location data */
		var  map_lat=location.coords.latitude
			,map_lon=location.coords.longitude
			,map_acc=(GEOLOC.pos ? true : false);

		/* Zoom in on current geolocated position */
		if (!nofollow) map.setView([map_lat, map_lon], (map_acc ? 14 : 9) );

		/* Estimated current location */
		var marker = CLIENT.MAP.marker;
		marker.setLatLng([map_lat, map_lon]);
		if (map_acc) marker.addTo(map); else map.removeLayer(marker);
	}
};


function init() {
	var deferred=when.defer();
	var initialize=function() {

		/* Init buttons */
		SCREENS.initButtons();


		/* Initialize webapp install */
		if (WEBAPP.installSupported()) {
			// If installable, check if installed
			WEBAPP.installed().then(
				// Installed
				function (res) {
					document.body.classList.add("installed");
				}
			);
		} else {
			document.body.classList.add("noinstalls");
			UI.displayNotification("WebApp installs not supported.");
		}


		/* Set up visibility listeners */
		WEBAPP.Visibility();


		/* Set up anchors in body texts */
		var openPopup=function(e) { e.preventDefault(); window.open(e.originalTarget.href); return false; };
		var anchors=document.querySelectorAll("div.main>section>p>a[href]");
		var l=anchors.length;
		while (--l>=0) anchors[l].addEventListener("click",openPopup);


		// Show/hide some auxilliary fixed elements if screen size is too small
		UI.showHideFixedElements();

		// React to window size change (on rotation or display of on-screen keyboard)
		window.addEventListener("resize",UI.showHideFixedElements);


		/* Initialization finished */
		setTimeout(deferred.resolve,100);
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


/* Get current user info */
function apiQuerySelf() {
	return FSAPI.call(["users","self"]);
}

/* Get a list of venues at current location */
function apiQueryLocalVenues() {
	/* Request venues for venue list */
	var coords=GEOLOC.coords();
	var query={
		limit: 20
		,intent: "checkin"
	};
	if (coords) query.ll=coords;

	return FSAPI.call(['venues','search'],query);
}

/* Search venues around current location */
function apiQuerySearchVenues(search) {
	// Empty search query
	if (!search) return apiQueryLocalVenues();

	/* Request venues for venue list */
	var query={
		limit: 20
		,intent: "checkin"
		,query: search
	};

	// Accurate position, get coords() for "ll" (long/lat)
	if (GEOLOC.pos) {
		query.ll=GEOLOC.coords();

	// Geoip position, get location for "near"
	} else {
		query.near=GEOLOC.near;

	}

	return FSAPI.call(['venues','search'],query);
}

/* Update current user info */
function updateSelf(res) {
	var user=res.response.user
		,checkin=user.checkins&&user.checkins.items&&user.checkins.items.length>0 ?user.checkins.items[0] :null;

	// Store user info
	FSAPI.user=user;

	// Authenticated and logged in
	document.body.classList.add("authenticated");

	// Update UI
	UI.setTitle("Welcome, "+FSAPI.user.lastName+"!");
	updateLastCheckin(checkin);

	return when.resolve();
}

function updateVenueList(res) {
	/* Parse results */
	var venues=FSAPI.venues=res.response.venues
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
			? '<aside class="pack-end"><img alt="'+vi.categories[0].name+'" src="'+vi.categories[0].icon.prefix+'64'+vi.categories[0].icon.suffix+'"></aside>' +'<a href="#venue"><p>'+vi.name+' <strong></strong></p>' +'<p>'+(vi.location.address||"")+'</p></a>'
			: '<a href="#venue"><p>'+vi.name+'</p><p>'+(vi.location.address||"")+'</p></a>'
		);

		li.dataset.venueId=i;
		li.dataset.action="showVenue";
		li.addEventListener("click",UI.handlerFunction);

		vlist.appendChild(li);
	}
}

function updateLastCheckin(checkin) {
	var main_profile=$("#main-profile>ul>li");

	if (checkin) {
		main_profile.innerHTML="<p>"+checkin.venue.name+"</p><p>"+FSUtil.checkinDate(FSUtil.getTimestamp(checkin))+(checkin.points?"<em>+"+checkin.points.total+"&nbsp;pts</em>":"")+"</p>";
	} else {
		main_profile.innerHTML="<p>No check-ins recorded yet, get out there!</p>";
	}
}

function onLocationUpdated(position) {
	// Update minimap, but not full-screen map
	CLIENT.MAP.updateViewport(
		document.body.classList.contains("fullmap") ? "nofollow" : null
	);
}

function resetCheckinForm() {
	// Reset form
	document.forms.publishCheckin.reset();

	// Remove image attachment
	UI.handlers.removeAttachedPhoto();

	// Disable checkin button
	$("#venue button[data-action=\"publishCheckin\"]").disabled=true;

	// Remove CLIENT checkin object
	delete CLIENT.CHECKIN;
}



/* Main program FLOW logic */
var FLOW={};

try {
	/* [init]: Initialize */
	FLOW.init=init();


	/* When [init] -> [auth]: Authenticate user */
	FLOW.auth=when( FLOW.init

		// Wait for document load & fetch auth token
		,CLIENT.authorize	)

		// Request user info with the auth token that we got
		.then( apiQuerySelf )

		// Store and display user info
		.then( updateSelf )

		.then ( 

			// Initialization finished, user authenticated so show main screen
			function () {
				SCREENS.start("main");
			}

			// Failed
			,function (err) {
				// Handle Failures
				if (err instanceof Failure) {
					if (err.type==="unauthorized") {
						// Unauthorized user, not an error at this point
					} else {
						err.fail();
					}

				// Other exceptions
				} else if (err) alert(err);

				// Initialization finished, but currently authenticated so show the auth screen
				SCREENS.start("auth");

				// reject Auth Flow
				throw err;
			}

		);


	/* [auth] -> [geo]: Basic location  */
	FLOW.geo=when( FLOW.auth 

		// Auth success, init geolocation
		, GEOLOC.init

		// Auth failed, reject Geo Flow
		,function (err) { throw null; }
	)

		// When got a location, show it on map and continue following location
		.then(
			function(res) {
				// Display map
				CLIENT.MAP.show();
			}

			// Failed
			,function (err) {
				// Handle Failures
				if (err instanceof Failure) {
					err.fail();

				// Other exceptions
				} else if (err) alert(err);

				// reject Geo Flow
				throw err;
			}
		);


	/* [geo] -> [gps]: Precise geolocation */
	FLOW.gps=when ( FLOW.geo , function () {

		// Fetch and follow location
		return GEOLOC.followLocation(onLocationUpdated);
	});

	// If/when GPS flow rejects/timeouts, use GEO flow as a fallback
	FLOW.location=when(FLOW.gps
		,function() { return FLOW.gps; }
		,function() { return FLOW.geo; }
	);

	/* When [auth] & [geo] -> [explore]: Show venue list & map */
	FLOW.explore=when.join(FLOW.auth , FLOW.location )

		// User is authenticated and we have got a geolocation, check for recommended venues around current position
		.then( apiQueryLocalVenues

			// when.join failed, reject Explore Flow
			,function (err) { throw null; }
		)

		// List venues around current location
		.then( updateVenueList

			// Failed
			,function (err) {
				// Handle Failures
				if (err instanceof Failure) {
					err.fail();

				// Other exceptions
				} else if (err) alert(err);

				// reject Explore Flow
				throw err;
			}
		);
}

catch (err) {
	if (err instanceof Failure) err.fail(); else if (err) alert(err);
}

	/* ---DEBUG---
	window.APPUI=UI;
	window.APPFS=FSAPI;
	//*/

return {};

});