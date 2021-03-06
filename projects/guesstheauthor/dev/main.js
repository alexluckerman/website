//GroupMe object: takes a client ID and an optional groupId, used to make all calls to the GroupMe API
function GroupMe(client_id, groupId) {
    this.auth = new URL(window.location).searchParams.get("access_token");
        if (typeof this.auth != "string") {
            window.location = "https://oauth.groupme.com/oauth/authorize?client_id=" + client_id;
        }
    this.groupId = groupId;
    this.authToken = "?token=" + this.auth;
    this.apiLink = "https://api.groupme.com/v3/";
    
    this.makeRequest = function (method, reqtype, params) {
        var xhr = new XMLHttpRequest();
        var fullUrl = this.apiLink + reqtype + this.authToken + params;
        xhr.open(method, fullUrl, false);
        xhr.send();
        if (method == "POST") {
            return xhr.status;
        }
        return JSON.parse(xhr.response).response;
    };
    
    this.groupMembers = this.makeRequest("GET", "groups/" + this.groupId, "").members;
    this.userId = this.makeRequest("GET", "users/me", "").id;
    this.groupList = this.makeRequest("GET", "groups", "&per_pageomit=members");
    
    this.fetchMessages = function (quotebook, earliestMessage, second) {
        quotebook = typeof quotebook != 'undefined' ? quotebook : [];
        var loaded = loaded | false;
        
        var before = typeof earliestMessage !== 'undefined' ? "&before_id=" + earliestMessage : "";
        var url = before + "&limit=" + NUM_MESSAGES_PER_REQ;
        var msgResp = this.makeRequest("GET", "groups/" + this.groupId + "/messages", url);
        console.log(msgResp);
        
        //test if book is updated
        if (!second && msgResp.count == window.localStorage.getItem("GroupMe_msgCount") && this.groupId.toString() == window.localStorage.getItem("GroupMe_groupId")) {
                quotebook = JSON.parse(window.localStorage.getItem('GroupMe_currGroupMsgs'));
                console.log("Updated quote book found!");
                loaded = true;
        }
        
        //if not, add all messages to quotebook
        else {
            var k = quotebook.length;
            var l = msgResp.messages.length;
            for(var j = 0; j < l; j++) {
                console.log(j+k);
                quotebook[j+k] = msgResp.messages[j];
            }
            //i++;
            earliestMessage = msgResp.messages[l - 1].id;
            if (l < NUM_MESSAGES_PER_REQ) {
                loaded = true;
            }
        }
        
        // evaluate if the quotebook is loaded
        if (loaded) {
            window.localStorage.setItem('GroupMe_groupId', this.groupId);
            window.localStorage.setItem('GroupMe_msgCount', msgResp.count);
            window.localStorage.setItem('GroupMe_currGroupMsgs', JSON.stringify(quotebook));
            console.log("All quotes loaded");
            return quotebook;
        }
        else {
            return this.fetchMessages(quotebook, earliestMessage, true);
        }
    }
    
    this.likeMessage = function (msg) {
        return 200 == this.makeRequest("POST", "messages/" + this.groupId + "/" + msg.id + "/like");
    };
    this.unlikeMessage = function (msg) {
        return 200 == this.makeRequest("POST", "messages/" + this.groupId + "/" + msg.id + "/unlike");
    };
}

//Quote object
function Quote (quote, user) {
    this.id = quote.id;
    this.rawText = quote.text;
    this.poster = quote.name;
    this.numLikes = quote.favorited_by.length;
    this.time = new Date(quote.created_at * 1000).toDateString();
    if (typeof user != "undefined") {
        this.liked = false;
        for (var i = 0; i < this.numLikes; i++) {
            if (this.id == quote.favorited_by[i])
            {
                this.liked = true;
            }
        }
    }
    this.process = function() {
        if (this.rawText === null) {
            return false;
        }
        message = this.rawText.split('-');
        if (message.length == 2 && message[0].length > 0 && this.numLikes >= 2) {
            this.text = message[0];
            this.author = message[1];
            return true;
        }
        else {
            return false;
        }
    }
}

//QuoteGenerator object: takes an array of messages, used to generate Quote objects
function QuoteGenerator(quotebook, user) {
    this.quotebook = quotebook;
    this.user = user;
    this.getQuote = function () {
        var randMsgNum = Math.floor(Math.random() * this.quotebook.length);
        var quote = new Quote(quotebook[randMsgNum], this.user);
        return quote;
    }
}

// Begin QuoteGame specific code
var storage, messagesViewed;
var NUM_MESSAGES_PER_REQ = 100, NUM_GUESS_OPTIONS = 4;

function init() {
    
    storage = window.localStorage;
    messagesViewed = parseInt(storage.getItem("QuoteGame_msgsViewed")) || 0;
    var groupId = storage.getItem("QuoteGame_groupId");
    var gm;
    if (groupId !== null) {
        gm = new GroupMe("ZDxIRTOlmsiv6iOwlmLextWonlTK5vGqB6rWI8J2dnJfkiRB", groupId);
        loadQuotes(gm);
    }
    else {
        gm = new GroupMe("ZDxIRTOlmsiv6iOwlmLextWonlTK5vGqB6rWI8J2dnJfkiRB");
        displayGroups(gm);
    }
}

function displayGroups(gm) {
    var groups = gm.groupList;
    var groupDiv = document.getElementById("groups");
    for(var i = 0; i < groups.length; i++) {
        var element = document.createElement("p");
        var textNode = document.createTextNode(groups[i].name);
        element.appendChild(textNode);
        element.id = "group" + i;
        groupDiv.appendChild(element);
    }
    groupDiv.addEventListener("click", function(e) {
            gm.groupId = groups[parseInt(e.target.id.substring(5))].id;
            storage.setItem("QuoteGame_groupId", gm.groupId);
            groupDiv.style.display = "none";
            loadQuotes(gm);
        });
    groupDiv.style.display = "block";
}

function loadQuotes(gm) {
    var quotebook = gm.fetchMessages();
    var user = gm.userId;
    var qg = new QuoteGenerator(quotebook, user);
    renderQuote(qg);
    
    document.onkeypress = function(e) {
        e = e || window.event;
        if (e.key == "n") {
            renderQuote(qg);
        } else if (e.key == "r") {
            revealAnswer();
        } else if (e.key == "g") {
            displayGroups(gm);
        } else if (e.key == "v") {
            console.log(gm);
            console.log(quotebook);
            console.log(qg);
        }
    };
    
    document.getElementById("revealButton").addEventListener("click", revealAnswer);
    document.getElementById("newQuoteButton").addEventListener("click", function (qg) { renderQuote(qg); });
    
    document.getElementById("app").style.display = "block";
    window.onunload = function() {
        window.localStorage.setItem("QuoteGame_msgsViewed", messagesViewed);
    };
}

function revealAnswer() {
    document.getElementById("reveal").style.display = "inline";
}

function renderQuote(qg) {
    var message = qg.getQuote();
    while (!message.process()) {
        message = qg.getQuote();
    }
    
    var quote = document.getElementById("quote");
    var author = document.getElementById("author");
    var poster = document.getElementById("poster");
    var reveal = document.getElementById("reveal");
    var time = document.getElementById("time");
    var likes = document.getElementById("likes");
    
    reveal.style.display = "none";
    quote.innerHTML = message.text;
    author.innerHTML = message.author;
    poster.innerHTML = message.poster;
    time.innerHTML = message.time;
    likes.innerHTML = message.numLikes;
    messagesViewed++;
}

function toggleLike() {
    if (curQuoteLiked === true) {
        //unlike
    }
    else {
        //like
    }
}