;(function(global) {
  /**
   * Console-polyfill. MIT license.
   * https://github.com/paulmillr/console-polyfill
   * Make it safe to do console.log() always.
   */
  'use strict';
  global.console = global.console || {};
  var con = global.console,
    prop,
    method,
    empty = {},
    dummy = function() {},
    properties = ['memory'],
    methods = ['assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
      'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
      'markTimeline', 'profile', 'profiles', 'profileEnd', 'show', 'table',
      'time', 'timeEnd', 'timeline', 'timelineEnd', 'timeStamp', 'trace',
      'warn'];

  while (prop = properties.pop())
    if (!con[prop])
      con[prop] = empty;

  while (method = methods.pop())
    if (typeof con[method] !== 'function')
      con[method] = dummy;

  // Using `this` for web workers & supports Browserify / Webpack.
})(typeof window === 'undefined' ? this : window);

(function(root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}

  // Use polyfill for setImmediate for performance gains
  var asap = (typeof setImmediate === 'function' && setImmediate) ||
    function(fn) { setTimeoutFunc(fn, 1); };

  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function() {
      fn.apply(thisArg, arguments);
    };
  }

  var isArray = Array.isArray || function(value) { return Object.prototype.toString.call(value) === "[object Array]"; };

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    asap(function() {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) { reject(self, e); }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise){
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function(onFulfilled, onRejected) {
    var prom = new Promise(noop);
    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function () {
    var args = Array.prototype.slice.call(arguments.length === 1 && isArray(arguments[0]) ? arguments[0] : arguments);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;
      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) { res(i, val); }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }
      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for(var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @private
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    asap = fn;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);

(function (global, undefined) {
  "use strict";

  if (global.setImmediate) {
    return;
  }

  var nextHandle = 1; // Spec says greater than zero
  var tasksByHandle = {};
  var currentlyRunningATask = false;
  var doc = global.document;
  var setImmediate;

  function addFromSetImmediateArguments(args) {
    tasksByHandle[nextHandle] = partiallyApplied.apply(undefined, args);
    return nextHandle++;
  }

  // This function accepts the same arguments as setImmediate, but
  // returns a function that requires no arguments.
  function partiallyApplied(handler) {
    var args = [].slice.call(arguments, 1);
    return function() {
      if (typeof handler === "function") {
        handler.apply(undefined, args);
      } else {
        (new Function("" + handler))();
      }
    };
  }

  function runIfPresent(handle) {
    // From the spec: "Wait until any invocations of this algorithm started before this one have completed."
    // So if we're currently running a task, we'll need to delay this invocation.
    if (currentlyRunningATask) {
      // Delay by doing a setTimeout. setImmediate was tried instead, but in Firefox 7 it generated a
      // "too much recursion" error.
      setTimeout(partiallyApplied(runIfPresent, handle), 0);
    } else {
      var task = tasksByHandle[handle];
      if (task) {
        currentlyRunningATask = true;
        try {
          task();
        } finally {
          clearImmediate(handle);
          currentlyRunningATask = false;
        }
      }
    }
  }

  function clearImmediate(handle) {
    delete tasksByHandle[handle];
  }

  function installNextTickImplementation() {
    setImmediate = function() {
      var handle = addFromSetImmediateArguments(arguments);
      process.nextTick(partiallyApplied(runIfPresent, handle));
      return handle;
    };
  }

  function canUsePostMessage() {
    // The test against `importScripts` prevents this implementation from being installed inside a web worker,
    // where `global.postMessage` means something completely different and can't be used for this purpose.
    if (global.postMessage && !global.importScripts) {
      var postMessageIsAsynchronous = true;
      var oldOnMessage = global.onmessage;
      global.onmessage = function() {
        postMessageIsAsynchronous = false;
      };
      global.postMessage("", "*");
      global.onmessage = oldOnMessage;
      return postMessageIsAsynchronous;
    }
  }

  function installPostMessageImplementation() {
    // Installs an event handler on `global` for the `message` event: see
    // * https://developer.mozilla.org/en/DOM/window.postMessage
    // * http://www.whatwg.org/specs/web-apps/current-work/multipage/comms.html#crossDocumentMessages

    var messagePrefix = "setImmediate$" + Math.random() + "$";
    var onGlobalMessage = function(event) {
      if (event.source === global &&
          typeof event.data === "string" &&
          event.data.indexOf(messagePrefix) === 0) {
        runIfPresent(+event.data.slice(messagePrefix.length));
      }
    };

    if (global.addEventListener) {
      global.addEventListener("message", onGlobalMessage, false);
    } else {
      global.attachEvent("onmessage", onGlobalMessage);
    }

    setImmediate = function() {
      var handle = addFromSetImmediateArguments(arguments);
      global.postMessage(messagePrefix + handle, "*");
      return handle;
    };
  }

  function installMessageChannelImplementation() {
    var channel = new MessageChannel();
    channel.port1.onmessage = function(event) {
      var handle = event.data;
      runIfPresent(handle);
    };

    setImmediate = function() {
      var handle = addFromSetImmediateArguments(arguments);
      channel.port2.postMessage(handle);
      return handle;
    };
  }

  function installReadyStateChangeImplementation() {
    var html = doc.documentElement;
    setImmediate = function() {
      var handle = addFromSetImmediateArguments(arguments);
      // Create a <script> element; its readystatechange event will be fired asynchronously once it is inserted
      // into the document. Do so, thus queuing up the task. Remember to clean up once it's been called.
      var script = doc.createElement("script");
      script.onreadystatechange = function () {
        runIfPresent(handle);
        script.onreadystatechange = null;
        html.removeChild(script);
        script = null;
      };
      html.appendChild(script);
      return handle;
    };
  }

  function installSetTimeoutImplementation() {
    setImmediate = function() {
      var handle = addFromSetImmediateArguments(arguments);
      setTimeout(partiallyApplied(runIfPresent, handle), 0);
      return handle;
    };
  }

  // If supported, we should attach to the prototype of global, since that is where setTimeout et al. live.
  var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global);
  attachTo = attachTo && attachTo.setTimeout ? attachTo : global;

  // Don't get fooled by e.g. browserify environments.
  if ({}.toString.call(global.process) === "[object process]") {
    // For Node.js before 0.9
    installNextTickImplementation();

  } else if (canUsePostMessage()) {
    // For non-IE10 modern browsers
    installPostMessageImplementation();

  } else if (global.MessageChannel) {
    // For web workers, where supported
    installMessageChannelImplementation();

  } else if (doc && "onreadystatechange" in doc.createElement("script")) {
    // For IE 6–8
    installReadyStateChangeImplementation();

  } else {
    // For older browsers
    installSetTimeoutImplementation();
  }

  attachTo.setImmediate = setImmediate;
  attachTo.clearImmediate = clearImmediate;
}(typeof self === "undefined" ? typeof global === "undefined" ? this : global : self));

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

MessageHandler.prototype.error = function(error, callback) {
  this.response.status = false;
  this.response.message = error.toString();
  if(console) {
    if(console.error) {
      console.error(error);
    }
    else if(console.log) {
      console.log(error);
    }
  }
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
        console.error("Failure", error);
        self.response.data = xhr.responseText;
        self.response.status = false;
        self.response.message = "Request failed";
      } finally {
        callback(self.response);
      }
    })
    .catch(function(xhr) {
      console.error("Failure", xhr);
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

  ajax.run("GET", "http://seer.scientech.com/Home/SearchUnique/", { "uk": "H1276404" }).then(function(responseData) {
    if(!responseData) {
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

MessageHandler.prototype.getSeerInfo = function(payload, callback) {
  var ajax = new AjaxManager(),
    self = this,
    responses = {},
    setData = function(obj) {
      self.response.status = obj.status;
      self.response.url = '';
      self.response.message = obj.message;
      self.response.data = obj.data;
    },
    setError = function(err) {
      self.response.status = false;
      self.response.url = '';
      if(err && err.toString) {
        self.response.message = "Request failed: " + err.toString();
      }
      else {
        self.response.message = "Request failed";
      }
      self.response.data = '';
    };

  ajax.run(
    'GET',
    'http://seer.scientech.com/Home/SearchData/',
    { 'id': payload.inventoryId }
  ).then(function(responseData) {
    // process 'SearchData'
    var response = {};
    response.headers = responseData.headers;
    try {
      response.data = JSON.parse(responseData.data);
      response.status = true;
      response.message = "Request complete";
    } catch(error) {
      console.error("Failure", error);
      response.data = responseData;
      response.status = false;
      response.message = "Request failed";
    }

    responses.searchData = response;
    var dt = response.data;

    // call out to 'SearchUnique'
    if(dt && dt.ParentRecord && dt.ParentRecord.Member_primary_key) {
      return ajax.run('GET', 'http://seer.scientech.com/Home/SearchUnique/', {
        'uk': response.data.ParentRecord.Member_primary_key
      });
    }
    else if(dt && dt.OtherParents && dt.OtherParents.length > 0 && dt.OtherParents[0].Member_primary_key) {
      return ajax.run('GET', 'http://seer.scientech.com/Home/SearchUnique/', {
        'uk': response.data.OtherParents[0].Member_primary_key
      });
    }
    else if(Object.prototype.toString.call(dt) == '[object String]') {
      throw new Error('Invalid response data');
    }
    else {
      throw new Error('No unique id found');
    }
  }).then(function(responseData) {
    // process 'SearchUnique'
    var response = {};
    response.headers = responseData.headers;
    try {
      response.data = JSON.parse(responseData.data);
      response.status = true;
      response.message = "Request complete";
    } catch(error) {
      console.error("Failure", error);
      response.data = responseData;
      response.status = false;
      response.message = "Request failed";
    }

    responses.searchUnique = response;

    if(Object.prototype.toString.call(response.data) == '[object String]')
      throw new Error('Invalid response data');
    return;
  }).then(function() {
    // TODO: reconcile differences in data between endpoints
    //responses.searchData
    //responses.searchUnique
    var obj = responses.searchUnique;

    setData(obj);

    callback(self.response);
  })['catch'](function(err) {
    console.error("Failure", err, [responses.searchUnique, responses.searchData]);
    if(responses.searchUnique) {
      // both exist, must be an error in munging
      setData(responses.searchUnique);
    }
    else if(responses.searchData) {
      // error before SearchUnique
      if(responses.searchData.status) {
        setData(responses.searchData);
      }
      else {
        setError(responses.searchData.message);
      }
    }
    else {
      // error before SearchData
      // nothing is salvagable
      setError(err);
    }

    callback(self.response);
  });
};

;(function(ms) {
  var AjaxManager = function() {
    var self = this;
  };

  AjaxManager.prototype.formatParams = function(params) {
    if(!params) return "";

    var list = [];
    for(var key in params) {
      if(!params.hasOwnProperty(key)) continue;
      list.push('' + key + '=' + params[key] + '');
    }
    return list.join('&');
  };

  AjaxManager.prototype.run = function(method, url, params, headers) {
    method = 'GET';
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

      //headers["content-type"] = 'application/x-www-form-urlencoded';
      var paramStr = self.formatParams(params);

      var checkComplete = function() {
        if(!window.inJsBHOAPI.reqResponseHeaders) {
          window.setTimeout(checkComplete, 100); // retry every 100 ms
          return;
        }

        var response = {
          data: window.inJsBHOAPI.reqResponse,
          headers: JSON.parse(JSON.stringify(window.inJsBHOAPI.reqResponseHeaders))
        };

        if(!window.inJsBHOAPI.reqResponse) {
          // empty string means it's not a JSON response (e.g., a login page)
          reject(response);
        }
        else {
          resolve(response);
        }
      };

      var urlStr = self.setParamsInUrl(url, paramStr);

      window.inJsBHO.getRequest(urlStr);
      checkComplete();
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

  window.MaximoSEER.AjaxManager = AjaxManager;
  window.AjaxManager = AjaxManager;
})(window.MaximoSEER = window.MaximoSEER || {});

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
    this.list = [];
  };

  DataContainer.prototype.setList = function(list) {
    list.sort(function(a, b) {
      var direction = -1, // greatest to least
        comparison = sortOnHand(a, b);
      return comparison * direction;
    });

    var self = this;
    this.total = 0;
    list.forEach(function(obj) {
      if(parseInt(obj.OnHand) > 0) self.totalOnHand += parseInt(obj.OnHand);
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
    totalCounter.innerHTML = '' + this.totalOnHand;
    titleText.innerHTML = this.label;

    titleContainer.setAttribute('class', 'source');
    titleContainer.appendChild(totalCounter);
    titleContainer.appendChild(titleText);

    this.container.appendChild(titleContainer);

    this.list.forEach(function(data){
      var item = document.createElement('li'),
        counterOnHand = document.createElement('span'),
        label = document.createElement('span');

      label.innerHTML = ' &mdash; ' + data.Facility;
      counterOnHand.setAttribute('class', 'counter available');
      counterOnHand.innerHTML = '' + (parseInt(data.OnHand) || '0');

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
    icon.setAttribute('class', 'indicator');
    icon.innerHTML = '&#9679;';
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
    return new Promise(function(resolve, reject) {
      var request = {
        "requestType": "getSeerInfo",
        "data": {
          "inventoryId": "" + inventoryId
        }
      };
      var ms = new MessageHandler();
      ms.getSeerInfo(request.data, function(response) {
        if(response.status) {
          resolve(response);
        }
        else {
          response.status = false;
          response.data = {};

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

      // scrape the page initially since the entire toolbar is re-initialized on
      // every full page load
      self.scrape();

      // scrape once, relying on setTimeout() to repeat entire process of
      // displaying toolbar
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
    var element = document.querySelectorAll('tr.tcr td.hl')[0];
    if(element) {
      return (element.innerText || '').trim();
    }
    return '';
  };

  Scraper.prototype.getFromPOLine = function() {
    var element = document.querySelectorAll('tr.tcr input[type="text"][title^="Item:"]')[0];
    if(element) {
      if(element.attributes.ov) return element.attributes.ov.value;
      return element.value;
    }
    return '';
  };

  Scraper.prototype.getFromPRLine = function() {
    var element = document.querySelectorAll('tr.tcr input[type="text"][title^="Item:"]')[0];
    if(element) {
      if(element.attributes.ov) return element.attributes.ov.value;
      return element.value;
    }
    return '';
  };

  Scraper.prototype.getFromDummyPage = function() {
    var element = document.querySelectorAll('[data-inventory-id].current')[0];
    if(element) {
      return element.getAttribute('data-inventory-id');
    }
    return '';
  };

  Scraper.prototype.scrape = function() {
    this.inventoryId = '';
    if(!this.inventoryId) this.inventoryId = this.getFromPRLine();
    if(!this.inventoryId) this.inventoryId = this.getFromPOLine();
    if(!this.inventoryId) this.inventoryId = this.getFromInventoryList();
    if(!this.inventoryId) this.inventoryId = this.getFromInventoryDetails();
    if(!this.inventoryId) this.inventoryId = this.getFromDummyPage();
    return this.inventoryId;
  };

  ms.Scraper = Scraper;
})(window.MaximoSEER = window.MaximoSEER || {});

;(function(ms){
  var SelfContainer = function(data) {
    this.data = {};
    this.list = [];
    this.totalOnHand = 0;

    if(data)
      this.setData(data);
  };

  SelfContainer.prototype.setData = function(data) {
    var focus = null;
    if(!focus && data.ParentRecord) {
      focus = data.ParentRecord;
    }

    if(!focus && data.OtherParents && data.OtherParents.length > 0) {
      focus = data.OtherParents[0];
    }

    if(focus) {
      this.data = focus;
      this.list = [this.data];
      this.totalOnHand = parseInt(focus.OnHand) || 0;
    }
  };

  ms.SelfContainer = SelfContainer;
})(window.MaximoSEER = window.MaximoSEER || {});

if(Number && !Number.prototype.between) {
  Number.prototype.between = function(start, end) {
    return !!(this > start && this < end);
  };
}


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

  var SurplusDataContainer = function(label) {
    var el = document.createElement('div');
    el.setAttribute('class', 'data');

    this.container = el;
    this.label = label;
    this.totalOnHand = 0;
    this.totalSurplus = 0;
    this.list = [];
  };

  SurplusDataContainer.prototype.setList = function(list) {
    list.sort(function(a, b) {
      var direction = -1, // greatest to least
        comparison = sortSurplus(a, b);
      if(comparison === 0) return sortOnHand(a, b) * direction;
      return comparison * direction;
    });

    var self = this;
    this.total = 0;
    list.forEach(function(obj) {
      if(parseInt(obj.OnHand) > 0) self.totalOnHand += parseInt(obj.OnHand);
      if(parseInt(obj.Surplus) > 0) self.totalSurplus += parseInt(obj.Surplus);
      if(self.list.length < 3) self.list.push(obj);
    });
  };

  SurplusDataContainer.prototype.toString = function() {
    return this.toNode().outerHTML;
  };

  SurplusDataContainer.prototype.toNode = function() {
    clear(this.container);

    var totalCounter = document.createElement('span'),
      titleContainer = document.createElement('p'),
      titleText = document.createElement('span'),
      listContainer = document.createElement('ul');
    totalCounter.setAttribute('class', 'count');
    totalCounter.innerHTML = '' + this.totalSurplus + ' / ' + this.totalOnHand;
    titleText.innerHTML = this.label;

    titleContainer.setAttribute('class', 'source');
    titleContainer.appendChild(totalCounter);
    titleContainer.appendChild(titleText);

    this.container.appendChild(titleContainer);

    this.list.forEach(function(data){
      var item = document.createElement('li'),
        counterOnHand = document.createElement('span'),
        counterSurplus = document.createElement('span'),
        label = document.createElement('span');

      label.innerHTML = ' &mdash; ' + data.Facility;
      counterOnHand.setAttribute('class', 'counter available');
      counterOnHand.innerHTML = ' / ' + (parseInt(data.OnHand) || '0');
      counterSurplus.setAttribute('class', 'counter extra');
      counterSurplus.innerHTML = '' + (parseInt(data.Surplus) || '0');

      item.appendChild(counterSurplus);
      item.appendChild(counterOnHand);
      item.appendChild(label);
      item.setAttribute('title', '' + data.ContactName + ' | ' + data.MainPhone);
      listContainer.appendChild(item);
    });

    if(this.list.length > 0) this.container.appendChild(listContainer);
    return this.container;
  };

  ms.SurplusDataContainer = SurplusDataContainer;
})(window.MaximoSEER = window.MaximoSEER || {});

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
          console.debug('Changing id');
          ms.toolbar.inventoryId = id;
          // get data via ajax
          sender.getSeerInfo(id).then(function(payload) {
            console.debug('Got successful API response', payload.data);
            // remove existing toolbar, if exists
            if(document.getElementById('MaximoSEER-Toolbar')) {
              document.body.removeChild(document.getElementById('MaximoSEER-Toolbar'));
            }

            ms.toolbarObj = new ms.Toolbar(id, payload.data);
            ms.toolbarEl = ms.toolbarObj.toNode();

            document.body.insertBefore(ms.toolbarEl, document.body.firstChild);
            // trigger resize window event so Maximo reflows document
            ms.triggerWindowResize();
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          }, function() {
            if(document.getElementById('MaximoSEER-Toolbar')) {
              document.body.removeChild(document.getElementById('MaximoSEER-Toolbar'));
            }
            ms.toolbarObj = new ms.Toolbar();
            ms.toolbarObj.setError('<h1 class="error-text">ERROR: Please <a href="http://seer.scientech.com/" target="_blank">login to SEER</a>, then refresh this page</h1>');
            ms.toolbarEl = ms.toolbarObj.toNode();

            document.body.insertBefore(ms.toolbarEl, document.body.firstChild);
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          }).catch(function(e) {
            console.debug('Something went wrong with the API call', e);
            window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
          });
        }
      }, function() {
        // could not find inventory id
        console.debug('Could not find inventory id');
        window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
      }).catch(function(err) {
        console.debug('Something went wrong scraping for the inventory id', err);
        window.setTimeout(ms.toolbarInit, ms.toolbar.scanRate);
      });
  };

  ms.triggerWindowResize = function() {
    try {
      var evt = window.document.createEvent('UIEvents');
      evt.initUIEvent('resize', true, false, window, 0);
      window.dispatchEvent(evt);
    }
    catch(e) {
      window.dispatchEvent(new Event('resize'));
    }
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
      self: null,
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
    this.data.others = new ms.SurplusDataContainer('SEER');
    this.data.pool = new ms.DataContainer('Vendor');
    this.data.rapid = new ms.DataContainer('Rapid');

    this.data.self = new ms.SelfContainer(payload);

    this.data.fleet.setList(payload.Fleet || []);
    this.data.others.setList(payload.Others || []);
    this.data.rapid.setList(payload.Rapid || []);

    // merge Pool and Pooling
    var poolData = [];
    (payload.Pool || []).forEach(function(data) { poolData.push(data); });
    (payload.Pooling || []).forEach(function(data) { poolData.push(data); });
    this.data.pool.setList(poolData);

    if(this.data.fleet.list.length > 0) {
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

(function(ms) {
  var bootstrap = function() {
    if(!window.document || !window.document.body) {
      window.setTimeout(bootstrap, 200); // retry 5x per second until successful
      return;
    }
    console.log('Bootstrapping MaxmioSEER toolbar');
    ms.toolbarInit().then(function() {
      console.log('Bootstrapped');
    });
  };

  bootstrap();
})(window.MaximoSEER = window.MaximoSEER || {});
