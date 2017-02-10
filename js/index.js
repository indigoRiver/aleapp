var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
		document.addEventListener("online", this.onOnline, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'app.receivedEvent(...);'
    onDeviceReady: function() {
		$(document).on("click", "#resetDB", function(){
			localStorage["lastUpdated"] = ''; //Global last updated for entire app
			navigator.notification.alert("Database reset. Please sync device. Be aware that a wifi connection is needed to download all of the product information.", function() {});
	
		});
		$( "#popupDialog" ).enhanceWithin().popup();
		$(document).on("click", "#enterAdmin", function(){
			if($("#adminPassword").val() == "ale"){
				$( ":mobile-pagecontainer" ).pagecontainer( "change", "admin.html", {transition: "pop"} );
			}else{
				navigator.notification.alert(
					'Incorrect password. Please try again.', false, 'Fail!', 'OK'
				);
			}
		});
		$(document).on("click", ".searchForm a", function(){
			var field = $(this).parent().find("input");
			app.searchBrochures(field);
		});
		
		
		$(document).on('touchstart', '#syncDB', app.syncDB);
		db = window.openDatabase("mainALE","1","Main DB ALE",1000000); //open the databsase on device startup
		db.transaction(app.initDB,app.dbError,app.dbReady);
		
		$(document).on('pagebeforeshow', '#homePage', function () {
			app.updateMainMenu();
			app.refreshBasket();
			window.sessionStorage.removeItem("searchResults");
		});	
		$(document).on("click", "#refreshMenu", function(){
			app.updateMainMenu();
		});
		
		$(document).on("click", ".sectorsMenu a", function(){
			window.sessionStorage.setItem("category", $(this).attr("rel"));
		});
		$(document).on("click", ".corporateMenu a", function(){
			window.sessionStorage.setItem("category", $(this).attr("rel"));
		});
		$(document).on("click", ".allMenu a", function(){
			window.sessionStorage.setItem("category", $(this).attr("rel"));
		});
		
		//set basket value to 0 on startup
		window.sessionStorage.setItem("basket", "0");
		

    },
	initDB: function(tx){
		//tx.executeSql('DROP TABLE IF EXISTS brochures');
		tx.executeSql("create table if not exists brochures (ID INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, name TEXT, description TEXT, sector TEXT, url TEXT, urlPreview TEXT, tags TEXT)");
		//tx.executeSql('DROP TABLE IF EXISTS sectors');
		tx.executeSql("create table if not exists sectors (ID INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT, name TEXT, imageurl TEXT)");
		//tx.executeSql('DROP TABLE IF EXISTS basket');
		tx.executeSql("create table if not exists basket (ID INTEGER PRIMARY KEY AUTOINCREMENT, brochures TEXT, name TEXT, business TEXT, country TEXT, email TEXT)");
	},
	dbReady: function(){
		console.log("DB initialization done.");
		//begin sync process
		if(navigator.network && navigator.connection.type != Connection.NONE) {
			app.syncDB();
			app.updateMainMenu();

		}else{ 
		}
	},
	syncDB: function(){
		if(navigator.network && navigator.connection.type == Connection.NONE) { 
			navigator.notification.alert("You need an internet connection to sync your app.", function() {});
		}else{
			var lastUpdated = localStorage["lastUpdated"] ? localStorage["lastUpdated"]  : ''; 
			console.log(lastUpdated)
			var brochures = '';
			$.mobile.loading( "show", {
				text: "Loading brochures",
			});
			$.ajax({ 
				type: "POST",
				cache: false,
				url: "https://www.indigoapps.co.uk/ale/admin/brochures/get_brochures_app",
				data: { lastUpdated: lastUpdated},
				dataType: "json",
				success: function(result){					
					if(result != null){
						$.each(result, function(i, val) {
							var localImageName = val.url.substring(val.url.lastIndexOf('/')+1);
							var remoteImage = "https://www.indigoapps.co.uk/ale/admin/brochures/"+localImageName;
							var remoteImageEncoded = encodeURI(remoteImage);
							var localImageNamePreview = val.urlPreview.substring(val.urlPreview.lastIndexOf('/')+1);
							var remoteImagePreview = "https://www.indigoapps.co.uk/ale/admin/brochures/"+localImageNamePreview;
							var remoteImageEncodedPreview = encodeURI(remoteImagePreview);
							db.transaction(function(ctx) {
								ctx.executeSql("SELECT ID FROM brochures WHERE token = '"+val.ID+"' ", [], function(tx,checkres) { //select all from phoneDB 
									if(checkres.rows.length) {
										if(val.deleted != "1") { 
											tx.executeSql("UPDATE brochures SET name='"+val.name+"',description='"+val.description+"',sector='"+val.sector+"',tags='"+val.tags+"' WHERE token='"+val.ID+"'", [], function(tx, results){
											});
											app.downloadBrochure(remoteImageEncoded, localImageName, val.ID); //download image if we are updating product
											app.downloadBrochurePreview(remoteImageEncodedPreview, localImageNamePreview, val.ID); //download image if we are updating product
										} else {
											tx.executeSql("delete from brochures where token = "+val.ID+"", []);
										}
									} else {
										if(val.deleted != "1") {
											tx.executeSql("INSERT INTO brochures(name,description,sector,tags,token) VALUES('"+val.name+"','"+val.description+"','"+val.sector+"','"+val.tags+"','"+val.ID+"')", [], function(){
												app.downloadBrochure(remoteImageEncoded, localImageName, val.ID);
												app.downloadBrochurePreview(remoteImageEncodedPreview, localImageNamePreview, val.ID);
											
											});
										}
									}
								});
							}, function(err){
								alert("Error processing SQL: "+err.message);
							},function(){
								console.log("success update");
							    $.mobile.loading( "hide" );	
							});
						});	
						var count = Object.keys(result).length;
						if(count > 0){
							localStorage["lastUpdated"] = result[count-1].lastUpdated;
						}else{
						}
					}
					 $.mobile.loading( "hide" );	
				}
			})
			
			$.mobile.loading( "show", {
				text: "Loading sectors",
			});
			$.ajax({ 
				type: "POST",
				cache: false,
				url: "https://www.indigoapps.co.uk/ale/admin/sectors/get_sectors_app",
				data: { lastUpdated: lastUpdated},
				dataType: "json",
				success: function(result){					
					if(result != null){
						$.each(result, function(i, val) {
							var localImageName = val.imageurl.substring(val.imageurl.lastIndexOf('/')+1);
							var remoteImage = "https://www.indigoapps.co.uk/ale/admin/images/sectors/"+localImageName;
							var remoteImageEncoded = encodeURI(remoteImage);
							db.transaction(function(ctx) {
								ctx.executeSql("SELECT ID FROM sectors WHERE token = '"+val.ID+"' ", [], function(tx,checkres) { //select all from phoneDB 
									if(checkres.rows.length) {
										if(val.deleted != "1") { 
											tx.executeSql("UPDATE sectors SET name='"+val.name+"' WHERE token='"+val.ID+"'", [], function(tx, results){
											});
											app.downloadSectorImage(remoteImageEncoded, localImageName, val.ID); //download image if we are updating product
										} else {
											tx.executeSql("delete from sectors where token = "+val.ID+"", []);
										}
									} else {
										if(val.deleted != "1") {
											tx.executeSql("INSERT INTO sectors(name,token) VALUES('"+val.name+"','"+val.ID+"')", [], function(){
											});
											app.downloadSectorImage(remoteImageEncoded, localImageName, val.ID);
										}
									}
								});
							}, function(err){
								alert("Error processing SQL: "+err.message);
							},function(){
								console.log("success update");
							    $.mobile.loading( "hide" );	
							});
						});	
						var count = Object.keys(result).length;
						if(count > 0){
							localStorage["lastUpdated"] = result[count-1].lastUpdated;
						}else{
						}
					}
					 $.mobile.loading( "hide" );	
				}
			})
		} //end connection
	},
	downloadBrochure: function(remoteImage, localImageName, brochureID){
	    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
			var ft = new FileTransfer();
			fileSystem.root.getFile(localImageName, {create: true, exclusive: false}, function(fileEntry) {
				var localPath = fileEntry.toURL();
				if (device.platform === "Android" && localPath.indexOf("file://") === 0) {
					localPath = localPath.substring(7);
				}
				ft.download(remoteImage, localPath, function(entry) {
					db.transaction(function(ctx) {
						ctx.executeSql("UPDATE brochures SET url = '"+entry.toURL()+"' WHERE token = '"+brochureID+"' ", [], function(tx,checkres) { //select all from phoneDB 

						});
					}, function(err){
					//app.transactionError1(err);
					});
				}, function(error){
					//app.transactionError1(error);
				}, true);
			}, function(err){
				//app.transactionError1(err);
			});
		}, function(e){
			//app.transactionError1(e);	
		});		
	},
	downloadBrochurePreview: function(remoteImage, localImageName, brochureID){
	    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
			var ft = new FileTransfer();
			fileSystem.root.getFile(localImageName, {create: true, exclusive: false}, function(fileEntry) {
				var localPath = fileEntry.toURL();
				if (device.platform === "Android" && localPath.indexOf("file://") === 0) {
					localPath = localPath.substring(7);
				}
				ft.download(remoteImage, localPath, function(entry) {
					db.transaction(function(ctx) {
						ctx.executeSql("UPDATE brochures SET urlPreview = '"+entry.toURL()+"' WHERE token = '"+brochureID+"' ", [], function(tx,checkres) { //select all from phoneDB 
						});
					}, function(err){
					//app.transactionError2(err, 'a');
					});
				}, function(error){
					//app.transactionError2(error, 'b', remoteImage, localImageName, brochureID);
				}, true);
			}, function(err){
				//app.transactionError2(err, 'c');
			});
		}, function(e){
			//app.transactionError2(e, 'd');	
		});		
	},
	downloadSectorImage: function(remoteImage, localImageName, sectorID){
	    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function(fileSystem) {
			var ft = new FileTransfer();
			fileSystem.root.getFile(localImageName, {create: true, exclusive: false}, function(fileEntry) {
				var localPath = fileEntry.toURL();
				if (device.platform === "Android" && localPath.indexOf("file://") === 0) {
					localPath = localPath.substring(7);
				}
				ft.download(remoteImage, localPath, function(entry) {
					db.transaction(function(ctx) {
						ctx.executeSql("UPDATE sectors SET imageurl = '"+entry.toURL()+"' WHERE token = '"+sectorID+"' ", [], function(tx,checkres) { //select all from phoneDB 
						});
					}, function(err){
					//app.transactionError3(err);
					});
				}, function(error){
					//app.transactionError3(error);
				}, true);
			}, function(err){
				//app.transactionError3(err);
			});
		}, function(e){
			//app.transactionError3(e);	
		});		
	},
	updateMainMenu: function(){
		$(".sectorsMenu").empty();
		db.transaction(function(ctx) {
			ctx.executeSql("SELECT * FROM sectors ", [], function(tx,results) { //select all from phoneDB 
				if(results.rows.length > 0) {
					len = results.rows.length; 
					for (var i=0; i<len; i++){ 
						$(".sectorsMenu").append('<a class="light" data-role="button" rel="'+results.rows.item(i).ID+'" href="brochures.html" data-transition="flow">'+results.rows.item(i).name+'<img src="img/plus.png" /></a>');
					}
				}
			});
		}, function(err){
			app.transactionError(err);
		});
	},
	updateBrochuresCategory: function(sectorID){
		console.log(sectorID);
		db.transaction(function(ctx) {
			ctx.executeSql("SELECT * FROM sectors WHERE ID = '"+sectorID+"' ", [], function(tx,results) { //select all from phoneDB 
				if(results.rows.length > 0) {
					len = results.rows.length; 
					for (var i=0; i<len; i++){
						$(".currentCategory").html(results.rows.item(i).name);
					}
				}
			});
		}, function(err){
			app.transactionError(err);
		});
	},
	emptyBasket: function(){
		window.sessionStorage.setItem("basket", "0");
	},
	basketCount: function(){
		var currentBasket = window.sessionStorage.getItem("basket");
		if(currentBasket.charAt(0) == "," || currentBasket.charAt(0) == "0"){
			currentBasket = currentBasket.substring(1);
		}
		if(currentBasket == ""){
			var count = 0;
		}else{
			var array = currentBasket.split(",");
			var count = array.length;
		}
		return count;
	},
	refreshBasket: function(){
		$(".basketCount").html(app.basketCount());
	},
	updateBasket: function(brochureID){
		var currentBasket = window.sessionStorage.getItem("basket");
		if(currentBasket == "0"){
			window.sessionStorage.setItem("basket", "");
			currentBasket = window.sessionStorage.getItem("basket");
		}
		var array = currentBasket.split(",");
		var exists = array.indexOf(brochureID);
		if(exists == -1){
			array.push(brochureID);
		}
		var basketNew = array.join(",");
		window.sessionStorage.setItem("basket", basketNew);
	},
	removeFromBasket: function(brochureID){
		var currentBasket = window.sessionStorage.getItem("basket");
		if(currentBasket == "0"){
			window.sessionStorage.setItem("basket", "");
			currentBasket = window.sessionStorage.getItem("basket");
		}
		var array = currentBasket.split(",");
		var index = array.indexOf(brochureID);
		if (index > -1) {
			array.splice(index, 1);
		}
		var basketNew = array.join(",");
		window.sessionStorage.setItem("basket", basketNew);
	},
	sendBrochures: function(name, business, country, email, brochureIDs){
		$.mobile.loading( "show", {
			text: "Sending brochures",
		});
		
		$.ajax({
			type: "POST",
			cache: false,
			url: "https://www.indigoapps.co.uk/ale/admin/brochures/send_brochures",
			data: { name: name, business: business, country: country, email: email, brochures: brochureIDs},
			dataType: "json",
			success: function(result){
				$("#submitButton").removeClass('ui-disabled');
				if(result == 1){
					$("#submitForm form")[0].reset();
					app.emptyBasket();
					$("#basketList").empty();
					navigator.notification.alert(
						'Thank you! You will receive the brochures shortly.', false, 'Success', 'Thanks!'
					);
				}else if(result == 0){
					navigator.notification.alert(
						'Sorry, there has been a problem. Please contact a member of ALE', false, 'Fail', 'Thanks!'
					);
				}
				$.mobile.loading( "hide" );	
			}, 
			error: function() {
				alert(navigator.connection.type);
				alert(navigator.network.connection.type);	
			}
		})
	},
	searchBrochures: function(field){
		var searchTerms = $(field).val();
		var searchResults = [];
		db.transaction(function(ctx) {
			ctx.executeSql("SELECT * FROM brochures ", [], function(tx,results) { //select all from phoneDB 
				if(results.rows.length > 0) {
					len = results.rows.length; 
					for (var i=0; i<len; i++){ 	
						var thisID = results.rows.item(i).ID;
						var keywords = results.rows.item(i).tags;
						var thisArray = keywords.split(",");
						for (var x=0; x<thisArray.length; x++){ 
							if(app.trim(searchTerms).toLowerCase() == app.trim(thisArray[x]).toLowerCase() && searchTerms != ""){
								searchResults.push(thisID);
							}else{
								
							}
						}
					}
				}else{
					navigator.notification.alert(
						'There are no brochures.', false, 'Sorry...', 'OK!'
					);
				}
			});
		}, function(err){
			app.transactionError(err);
		}, function(){
			//go to brochures page and load all brochures in the array
			window.sessionStorage.setItem("searchResults", searchResults);
			$( ":mobile-pagecontainer" ).pagecontainer( "change", "brochures.html", {transition: "pop"} );
		});
		
	},
	trim: function(str){
		return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
	},
	transactionError: function(err){
		alert("Error: "+err.message);
		alert("Error: "+err.code);
	},
	transactionError1: function(err){
		alert("Error1: "+err.message);
		alert("Error1: "+err.code);
	},
	transactionError2: function(err, type, remoteImage, localImageName, brochureID){
		alert("Error2: "+err.message+" "+type);
		alert("Error2: "+remoteImage+" "+localImageName+" "+brochureID);
		alert("Error2: "+err.code);
	},
	transactionError3: function(err){
		alert("Error3: "+err.message);
		alert("Error3: "+err.code);
	}
};
