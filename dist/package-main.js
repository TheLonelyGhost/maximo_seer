var AjaxManager = function() {
  var self = this;
  this.xhr = new XMLHttpRequest();
  if(!("withCredentials" in this.xhr))
    throw "CORS is not supported in this browser. Please use an up-to-date browser, such as Chrome: https://www.google.com/chrome/desktop/index.html";

  this.xhr.onreadystatechange = function() {
    switch(self.xhr.readyState) {
      case XMLHttpRequest.UNSENT:
        self.events.trigger('ajax:queued', self.xhr);
        break;
      case XMLHttpRequest.OPENED:
        self.events.trigger('ajax:opened', self.xhr);
        break;
      case XMLHttpRequest.HEADERS_RECEIVED:
        self.events.trigger('ajax:headers', self.xhr);
        break;
      case XMLHttpRequest.LOADING:
        self.events.trigger('ajax:loading', self.xhr);
        break;
      case XMLHttpRequest.DONE:
        self.events.trigger('ajax:done', self.xhr);
        break;
    }
  };

  this.events = new EventManager(['ajax:done', 'ajax:headers', 'ajax:loading']);

  this.events.addListener('ajax:done', function(xhr) {
    if(Number(xhr.status).between(199, 300)) {
      // Cache if HTTP 2xx
      XHRCache.add(xhr.url, xhr.response);
    }
  });
};

// @private
AjaxManager.prototype.setHeaders = function(headers) {
  if(!headers) return;

  for(var header in headers) {
    if(!headers.hasOwnProperty(header)) continue;
    this.xhr.setRequestHeader(header, headers[header]);

    if(header.toLowerCase() == 'accept') {
      this.setContentType(headers[header].trim());
    }
  }
};

// transform obj into application/x-www-form-urlencoded
AjaxManager.prototype.formatParams = function(params) {
  if(!params) return "";

  var list = [];
  for(var key in params) {
    if(!params.hasOwnProperty(key)) continue;
    list.push('' + key + '=' + params[key] + '');
  }
  return list.join('&');
}

// @private
AjaxManager.prototype.setContentType = function(contentTypeHeader) {
  if(!contentTypeHeader) return;
  var html = new RegExp('^text/html', 'i'),
    json = new RegExp('^application/json', 'i');

  if(html.test(contentTypeHeader)) {
    this.xhr.responseType = 'document';
  }
  else if(json.test(contentTypeHeader)) {
    this.xhr.responseType = 'json';
  }
  else {
    this.xhr.responseType = 'text';
  }
};

AjaxManager.prototype.run = function(method, url, params, headers) {
  if(!params) params = {};
  if(!headers) headers = {};
  var self = this;

  return new Promise(function(resolve, reject) {
    if(self.shouldCache) {
      var cachedResult = XHRCache.check(url);
      if(cachedResult) {
        // Cache hit!
        resolve(cachedResult);
      }
    }

    headers["content-type"] = 'application/x-www-form-urlencoded';
    var paramStr = self.formatParams(params);

    self.events.addListener('ajax:done', function() {
      if(Number(self.xhr.status).between(199, 300)) {
        resolve(self.xhr);
      }
      else {
        reject(self.xhr);
      }
    });

    if(method.toLowerCase() == 'get') {
      url = self.setParamsInUrl(url, paramStr);
      self.xhr.open(method, url, true);
      self.setHeaders(headers);
      self.xhr.send(null);
    }
    else {
      self.xhr.open(method, url, true);
      self.setHeaders(headers);
      self.xhr.send(paramStr);
    }
  });
};

AjaxManager.prototype.setParamsInUrl = function(url, paramString) {
  var splitUrl = url.split('?');
  if(splitUrl.length > 1) {
    return '' + splitUrl[0] + '?' + paramString + '&' + splitUrl[1];
  }
  else {
    return '' + splitUrl[0] + '?' + paramString;
  }
};

;(function(ms) {
  var clear = function(el) {
    // remove children so object references aren't destroyed
    while(el.firstChild) el.removeChild(el.firstChild);
    // just to be sure...
    el.innerHTML = '';
  };

  var sortOnHand = function(a, b) {
    if(!a.OnHand && !b.OnHand) {
      return 0;
    }
    else if(!a.OnHand) {
      return -1;
    }
    else if(!b.OnHand) {
      return 1;
    }

    return parseInt(a.OnHand) - parseInt(b.OnHand);
  };
  var sortSurplus = function(a, b) {
    if(!a.Surplus && !b.Surplus) {
      return 0;
    }
    else if(!a.Surplus) {
      return -1;
    }
    else if(!b.Surplus) {
      return 1;
    }

    return parseInt(a.Surplus) - parseInt(b.Surplus);
  };

  var DataContainer = function(label) {
    var el = document.createElement('div');
    el.setAttribute('class', 'data');

    this.container = el;
    this.label = label;
    this.totalOnHand = 0;
    //this.totalSurplus = 0;
    this.list = [];
  };

  DataContainer.prototype.setList = function(list) {
    list.sort(function(a, b) {
      var direction = -1, // greatest to least
        //comparison = sortSurplus(a, b);
        comparison = sortOnHand(a, b);
      //if(comparison == 0) return sortOnHand(a, b) * direction;
      return comparison * direction;
    });

    var self = this;
    this.total = 0;
    list.forEach(function(obj) {
      if(parseInt(obj.OnHand) > 0) self.totalOnHand += parseInt(obj.OnHand);
      //if(parseInt(obj.Surplus) > 0) self.totalSurplus += parseInt(obj.Surplus);
      if(self.list.length < 3) self.list.push(obj);
    });
  };

  DataContainer.prototype.toString = function() {
    return this.toNode().outerHTML;
  };

  DataContainer.prototype.toNode = function() {
    clear(this.container);

    var totalCounter = document.createElement('span'),
      titleContainer = document.createElement('p'),
      titleText = document.createElement('span'),
      listContainer = document.createElement('ul');
    totalCounter.setAttribute('class', 'count');
    totalCounter.innerHTML = '' + /* this.totalSurplus + ' / ' + */ this.totalOnHand;
    titleText.innerHTML = this.label;

    titleContainer.setAttribute('class', 'source');
    titleContainer.appendChild(totalCounter);
    titleContainer.appendChild(titleText);

    this.container.appendChild(titleContainer);

    this.list.forEach(function(data){
      var item = document.createElement('li'),
        counterOnHand = document.createElement('span'),
        //counterSurplus = document.createElement('span'),
        label = document.createElement('span');

      label.innerHTML = ' &mdash; ' + data.Facility;
      counterOnHand.setAttribute('class', 'counter available');
      //counterOnHand.innerHTML = ' / ' + (parseInt(data.OnHand) || '?');
      counterOnHand.innerHTML = '' + (parseInt(data.OnHand) || '?');
      //counterSurplus.setAttribute('class', 'counter extra');
      //counterSurplus.innerHTML = '' + (parseInt(data.Surplus) || '?');

      //item.appendChild(counterSurplus);
      item.appendChild(counterOnHand);
      item.appendChild(label);
      item.setAttribute('title', '' + data.ContactName + ' | ' + data.MainPhone);
      listContainer.appendChild(item);
    });

    if(this.list.length > 0) this.container.appendChild(listContainer);
    return this.container;
  };

  ms.DataContainer = DataContainer;
})(window.MaximoSEER = window.MaximoSEER || {});

var EventManager = function(events) {
  if(events.constructor !== Array) events = [];
  var queues = {};

  events.forEach(function(val) {
    queues[val] = [];
  });
  this.queues = queues;
};

EventManager.prototype.addListener = function(event, callback) {
  if(!this.hasOwnProperty('queues')) this.queues = {};
  if(!this.queues.hasOwnProperty(event)) this.queues[event] = [];

  if(this.queues[event].indexOf(callback) == -1) {
    this.queues[event].push(callback);
  }
};

EventManager.prototype.removeListener = function(event, callback) {
  if(!this.hasOwnProperty('queues')) this.queues = {};
  if(!this.queues.hasOwnProperty(event)) this.queues[event] = [];

  var index = this.queues[event].indexOf(callback);

  if(index != -1) this.queues[event].slice(index, 1);
};

EventManager.prototype.trigger = function(event, payload) {
  if(!this.queues) this.queues = {};
  if(!this.queues[event]) this.queues[event] = [];

  this.queues[event].forEach(function(callback) {
    callback(payload);
  });
};

;(function(ms) {
  var Indicator = function(status) {
    var title = document.createElement('h1'),
      link = document.createElement('a'),
      text = document.createElement('span'),
      icon = document.createElement('i');
    title.setAttribute('class', 'logo');
    text.innerHTML = 'SEER';
    icon.setAttribute('class', 'fa fa-circle indicator');
    title.appendChild(link);
    link.appendChild(icon);
    link.appendChild(text);
    link.setAttribute('target', '_blank');
    this.container = title;
    this.icon = icon;
    this.link = link;
    this.setStatus(status);
  };

  Indicator.prototype.setStatus = function(status) {
    this.icon.setAttribute('data-availability', status);
  };

  Indicator.prototype.setLink = function(inventoryId) {
    this.link.setAttribute('href', 'http://seer.scientech.com/s/' + inventoryId);
  };

  Indicator.prototype.toString = function() {
    return this.container.outerHTML;
  };

  Indicator.prototype.toNode = function() {
    return this.container;
  };

  ms.Indicator = Indicator;
})(window.MaximoSEER = window.MaximoSEER || {});

(function(ms) {
  window.document.addEventListener('DOMContentLoaded', function() {
    void 0;
    ms.toolbarInit().then(function() {
      void 0;
    });
  });
})(window.MaximoSEER = window.MaximoSEER || {});

// default response style:
//
// {
//   "status": true, // success?
//   "message": "Some message", // Human readable message
//   "data": {} // Free-form data pass-through
// }
var MessageHandler = function() {
  this.response = {
    "status": false,
    "message": "",
    "data": {}
  };
};

MessageHandler.prototype.default = function(callback) {
  this.response.status = false;
  this.response.message = "Unrecognized request type";

  callback(this.response);
};

// Expects payload in the following format:
//
// {
//   "user": "some-random-username@example.com",
//   "pass": "s00p3rs3k3wr"
// }
MessageHandler.prototype.login = function(payload, callback) {
  var username,
    password,
    lm = new LoginManager(),
    self = this;

  if(!payload) payload = {};
  if(payload.user) username = payload.data.user;
  if(payload.pass) password = payload.data.pass;

  lm.login(username, password).then(function(xhr) {
    self.response.status = true;
    self.response.message = "Logged in successfully";
    callback(self.response);
  }).catch(function(xhr) {
    self.response.status = false;
    self.response.message = "Error logging in";
    self.response.data = xhr;
    callback(self.response);
  });
};

// Expects payload in the following format:
// {
//   "method": "POST",
//   "url": "http://www.example.com/foo/bar",
//   "aggressiveCache": true,
//   "headers": {}, // [Optional]
//   "params": {} // [Optional]
// }
MessageHandler.prototype.ajax = function(payload, callback) {
  if(!payload) payload = {};
  if(!payload.data) payload.data = {};

  var ajax = new AjaxManager(),
    self = this;

  if(XHRCache.forceCache) ajax.shouldCache = true;
  if(payload.aggressiveCache) ajax.shouldCache = true;

  ajax.run(payload.data.method, payload.data.url, payload.data.params, payload.data.headers)
    .then(function(xhr) {
      self.response.url = xhr.responseURL;
      try {
        self.response.data = JSON.parse(xhr.responseText);
        self.response.status = true;
        self.response.message = "Request complete";
      } catch(error) {
        void 0;
        self.response.data = xhr.responseText;
        self.response.status = false;
        self.response.message = "Request failed";
      } finally {
        callback(self.response);
      }
    })
    .catch(function(xhr) {
      void 0;
      self.response.status = false;
      self.response.message = "Request failed";
      self.response.data = xhr.responseText;
      self.response.url = xhr.responseURL;
    });
};

MessageHandler.prototype.checkLoggedIn = function(callback) {
  var ajax = new AjaxManager(),
    self = this,
    isLoginPage = new RegExp('^https?://seer.scientech.com/Account/Login', 'i');

  ajax.run("GET", "http://seer.scientech.com/Home/SearchUnique/", { "uk": "H1276404" }).then(function(xhr) {
    if(isLoginPage.test(xhr.responseURL)) {
      self.response.status = false;
      self.response.message = "Needs Login";
    }
    else {
      self.response.status = true;
      self.response.message = "Already logged in";
    }
    callback(self.response);
  });
};

(function(ms) {
  var MessageSender = function() {
  };

  MessageSender.prototype.send = function(type, payload) {
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": type,
        "data": payload
      };
      var callback = function(response) {
        (response.status ? resolve : reject)(response);
      };

      var ms = new MessageHandler();
      switch(request.requestType) {
        case 'ajax':
          ms.ajax(request, callback);
          break;
        case 'login':
          ms.login(request.data, callback);
          break;
        case 'checkLoggedIn':
          ms.checkLoggedIn(callback);
          break;
        default:
          ms.default(callback);
          break;
      }
    });
  };

  MessageSender.prototype.sendAjax = function(payload) {
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": "ajax",
        "data": payload
      };
      var ms = new MessageHandler();
      ms.ajax(request, function(response) {
        (response.status ? resolve : reject)(response);
      });
    });
  };

  MessageSender.prototype.sendLogin = function(payload) {
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": "login",
        "data": {
          "user": username,
          "pass": pass
        }
      };
      var ms = new MessageHandler();
      ms.login(request.data, function(response) {
        (response.status ? resolve : reject)(response);
      });
    });
  };

  MessageSender.prototype.ensureLoggedIn = function() {
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": "checkLoggedIn"
      };
      var ms = new MessageHandler();
      ms.checkLoggedIn(request, function(response) {
        (response.status ? resolve : reject)(response);
      });
    });
  };

  MessageSender.prototype.getSeerInfo = function(inventoryId) {
    var isLoginPage = new RegExp('^https?://seer.scientech.com/Account/Login', 'i');
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": "ajax",
        "data": {
          "method": "GET",
          "url": "http://seer.scientech.com/Home/SearchData/",
          "aggressiveCache": false,
          "params": {
            "id": "" + inventoryId
          }
        }
      };
      var ms = new MessageHandler();
      ms.ajax(request, function(response) {
        if(!isLoginPage.test(response.url)) {
          delete response.url;
          (response.status ? resolve : reject)(response);
        }
        else {
          response.status = false;
          response.message = "Needs Login";
          response.data = {};
          delete response.xhr;

          reject(response);
        }
      });
    });
  };

  ms.MessageSender = MessageSender;
})(window.MaximoSEER = window.MaximoSEER || {});

(function(ms) {
  var Scraper = function() {
    this.inventoryId = '';
    this.observer = null;
  };

  Scraper.prototype.getInventoryId = function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      ///* STUB: */ resolve('1276404');
      //resolve('595842');
      //return;
      var finish = function() {
        if(self.inventoryId) {
          resolve(self.inventoryId);
        } else {
          reject(self.inventoryId);
        }
      };

      // set watcher in case of AJAX page reload
      //self.setWatcher(finish);

      // scrape the page initially since the entire toolbar is re-initialized on
      // every full page load
      self.scrape();
      finish();
    });
  };

  Scraper.prototype.getFromInventoryDetails = function() {
    var element = document.querySelectorAll('input[type="text"][title^="Item:"]')[0];
    if(element) {
      if(element.attributes.ov) return element.attributes.ov.value;
      return element.value;
    }
    return '';
  };

  Scraper.prototype.getFromInventoryList = function() {
    var element = document.querySelectorAll('td[currentrow="true"][role="gridcell"].hl')[0];
    if(element) {
      return (element.innerText || '').trim();
    }
    return '';
  };

  Scraper.prototype.getFromPOLine = function() {
    var element = document.querySelectorAll('tr[current="true"] input[type="text"][title^="Item:"]')[0];
    if(element) {
      if(element.attributes.ov) return element.attributes.ov.value;
      return element.value;
    }
    return '';
  };

  Scraper.prototype.setWatcher = function(callback) {
    if(!callback) callback = function() {};
    void 0;
    var self = this,
      target = document.getElementById('hiddenform').elements.namedItem('targetid'),
      init = {
        subtree: true,
        attributes: true,
        attributeFilter: ['value']
      };
    this.observer = new MutationObserver(function() {
      void 0;
      self.scrape();
      callback(self.inventoryId);
    });
    void 0;
    if(target) {
      observer.observe(target, init);
      void 0;
    }
    //function(changes) {
    //  // Used in inventory section of Maximo is `form#hiddenform` for internal
    //  // navigation, which only notifies us of a change to the page. Observing
    //  // the changes in one of the inputs on the form is a shim for certain
    //  // click events that change the content of the page.
    //  if(changes.object.value == '') {
    //    // once the form is automatically cleared at the end of the back-end
    //    // voodoo magic...
    //    self.scrape();
    //  }
    //};
  };

  Scraper.prototype.scrape = function() {
    this.inventoryId = '';
    if(!this.inventoryId) this.inventoryId = this.getFromPOLine();
    if(!this.inventoryId) this.inventoryId = this.getFromInventoryList();
    if(!this.inventoryId) this.inventoryId = this.getFromInventoryDetails();
    return this.inventoryId;
  };

  ms.Scraper = Scraper;
})(window.MaximoSEER = window.MaximoSEER || {});

if(Number && !Number.prototype.between) {
  Number.prototype.between = function(start, end) {
    return !!(this > start && this < end);
  };
}


(function(ms) {
  ms.toolbar = {};
  ms.toolbarObj = undefined;
  ms.toolbarEl = undefined;
  ms.toolbar.scanRate = 1000; // every 1 second

  ms.toolbarInit = function() {
    var scraper = new ms.Scraper(),
      sender = new ms.MessageSender();

    return scraper.getInventoryId()
      .then(function(id) {
        if(id === ms.toolbar.inventoryId) {
          // do nothing, remained the same
          window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
        }
        else {
          void 0;
          ms.toolbar.inventoryId = id;
          // get data via ajax
          sender.getSeerInfo(id).then(function(payload) {
            void 0;
            // remove existing toolbar, if exists
            if(document.getElementById('MaximoSEER-Toolbar')) {
              document.body.removeChild(document.getElementById('MaximoSEER-Toolbar'));
            }

            ms.toolbarObj = new ms.Toolbar(id, payload.data);
            ms.toolbarEl = ms.toolbarObj.toNode();

            document.body.insertBefore(ms.toolbarEl, document.body.firstChild);
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          }, function() {
            if(document.getElementById('MaximoSEER-Toolbar')) {
              document.body.removeChild(document.getElementById('MaximoSEER-Toolbar'));
            }
            ms.toolbarObj = new ms.Toolbar();
            ms.toolbarObj.setError('<h1>ERROR: Please <a href="http://seer.scientech.com/" target="_blank">login to SEER</a>, then refresh this page</h1>');
            ms.toolbarEl = ms.toolbarObj.toNode();

            document.body.insertBefore(ms.toolbarEl, document.body.firstChild);
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          }).catch(function() {
            void 0;
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          });
        }
      }, function() {
        // could not find inventory id
        void 0;
        window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
      }).catch(function(err) {
        void 0;
        window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
      });
  };
})(window.MaximoSEER = window.MaximoSEER || {});

;(function(ms){
  var clear = function(el) {
    // remove children so object references aren't destroyed
    while(el.firstChild) el.removeChild(el.firstChild);
    // just to be sure...
    el.innerHTML = '';
  };

  var Toolbar = function(inventoryId, data) {
    var el = document.createElement('div');
    el.setAttribute('id', 'MaximoSEER-Toolbar');

    this.container = el;
    this.indicator = new ms.Indicator();
    this.inventoryId = null;
    this.data = {
      inventoryId: null,
      fleet: null,
      others: null,
      pool: null,
      rapid: null
    };
    if(inventoryId)
      this.setInventoryId(inventoryId);
    if(data)
      this.setData(data);
  };

  Toolbar.prototype.setError = function(errorHTML) {
    this.errorHTML = errorHTML;
  };

  Toolbar.prototype.setData = function(payload) {
    this.data.fleet = new ms.DataContainer('SNC');
    this.data.others = new ms.DataContainer('SEER');
    this.data.pool = new ms.DataContainer('Vendor');
    this.data.rapid = new ms.DataContainer('Rapid');

    this.data.fleet.setList(payload.Fleet || []);
    this.data.others.setList(payload.Others || []);
    this.data.pool.setList(payload.Pool || []);
    this.data.rapid.setList(payload.Rapid || []);

    if(this.data.fleet.totalOnHand > 0) {
      this.indicator.setStatus('in-house');
    }
    else if(this.data.others.totalOnHand + this.data.pool.totalOnHand + this.data.rapid.totalOnHand > 0) {
      this.indicator.setStatus('scarce');
    }
    else {
      this.indicator.setStatus('nobody');
    }
  };

  Toolbar.prototype.setStatus = function(status) {
    this.indicator.setStatus(status);
  };

  Toolbar.prototype.clear = function() {
    clear(this.container);

    // add loading message
    var loading = document.createElement('h1');
    loading.setAttribute('class', 'loading');
    loading.innerHTML = 'Loading&hellip;';

    this.container.appendChild(loading);
  };

  Toolbar.prototype.setInventoryId = function(id) {
    id = parseInt(id);
    this.data.inventoryId = id;
    this.indicator.setLink(id);
    var el = document.createElement('div'),
      title = document.createElement('p'),
      value = document.createElement('p');
    el.setAttribute('class', 'data meta');
    title.innerHTML = 'Inventory Id:';
    title.setAttribute('class', 'source');
    value.innerHTML = id;

    el.appendChild(title);
    el.appendChild(value);
    this.inventoryId = el;
  };

  Toolbar.prototype.toString = function() {
    return this.toNode().outerHTML;
  };

  Toolbar.prototype.toNode = function() {
    clear(this.container);

    if(this.indicator)
      this.container.appendChild(this.indicator.toNode());
    if(this.inventoryId)
      this.container.appendChild(this.inventoryId);
    if(this.data.fleet)
      this.container.appendChild(this.data.fleet.toNode());
    if(this.data.others)
      this.container.appendChild(this.data.others.toNode());
    if(this.data.rapid)
      this.container.appendChild(this.data.rapid.toNode());
    if(this.data.pool)
      this.container.appendChild(this.data.pool.toNode());

    if(this.errorHTML) {
      clear(this.container);
      this.container.innerHTML = this.errorHTML;
    }

    return this.container;
  };

  ms.Toolbar = Toolbar;
})(window.MaximoSEER = window.MaximoSEER || {});

var XHRCache = {
  forceCache: false,
  capacity: 250,
  entries: {},
  count: 0,
  check: function(key) {
    if(key in this.entries) {
      this.entries[key].hits++;
      return this.entries[key].data;
    }
    return null;
  },
  add: function(key, value) {
    if(key in this.entries) return;

    this.entries[key] = {
      "data": value,
      "timestamp": Date.now(),
      "hits": 1
    };
    this.count++;

    if(this.count > this.capacity) this.prune();
  },
  prune: function() {
    var now = Date.now(),
      bottom = [];

    for(var key in this.entries) {
      var time = now - this.entries[key].timestamp;
      if(time <= 0) continue;

      var cacheObj = {
        "key": key,
        "weight": this.entries[key].hits / time
      };
      bottom.push(cacheObj);
    }
  },
  clear: function() {
    this.entries = {};
    this.count = 0;
  }
};
