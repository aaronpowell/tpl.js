(function (global) {
    'use strict';

    var Q = (function (nextTick) {
      var isFunction = function (obj) {
        return obj && obj.constructor == Function;
      };
      var isArray = function (obj) {
        return obj && obj.constructor == Array;
      };

      var defer = function() {
        var pending = [],
            value, deferred;

        deferred = {
          resolve: function(val) {
            if (pending) {
              var callbacks = pending;
              pending = undefined;
              value = ref(val);

              if (callbacks.length) {
                nextTick(function() {
                  var callback;
                  for (var i = 0, ii = callbacks.length; i < ii; i++) {
                    callback = callbacks[i];
                    value.then(callback[0], callback[1], callback[2]);
                  }
                });
              }
            }
          },

          reject: function(reason) {
            deferred.resolve(reject(reason));
          },

          notify: function(progress) {
            if (pending) {
              var callbacks = pending;


              if (pending.length) {
                nextTick(function() {
                  var callback;
                  for (var i = 0, ii = callbacks.length; i < ii; i++) {
                    callback = callbacks[i];
                    callback[2](progress);
                  }
                });
              }
            }
          },

          promise: {
            then: function(callback, errback, progressback) {
              var result = defer();
              var wrappedCallback = function(value) {
                try {
                  result.resolve((isFunction(callback) ? callback : defaultCallback)(value));
                } catch(e) {
                  result.reject(e);
                }
              };

              var wrappedErrback = function(reason) {
                try {
                  result.resolve((isFunction(errback) ? errback : defaultErrback)(reason));
                } catch(e) {
                  result.reject(e);
                }
              };

              var wrappedProgressback = function(progress) {
                try {
                  result.notify((isFunction(progressback) ? progressback : defaultCallback)(progress));
                } catch(e) {
                }
              };

              if (pending) {
                pending.push([wrappedCallback, wrappedErrback, wrappedProgressback]);
              } else {
                value.then(wrappedCallback, wrappedErrback, wrappedProgressback);
              }

              return result.promise;
            },

            "catch": function(callback) {
              return this.then(null, callback);
            },

            "finally": function(callback) {
              function makePromise(value, resolved) {
                var result = defer();
                if (resolved) {
                  result.resolve(value);
                } else {
                  result.reject(value);
                }
                return result.promise;
              }

              function handleCallback(value, isResolved) {
                var callbackOutput = null;
                try {
                  callbackOutput = (callback ||defaultCallback)();
                } catch(e) {
                  return makePromise(e, false);
                }
                if (callbackOutput && isFunction(callbackOutput.then)) {
                  return callbackOutput.then(function() {
                    return makePromise(value, isResolved);
                  }, function(error) {
                    return makePromise(error, false);
                  });
                } else {
                  return makePromise(value, isResolved);
                }
              }

              return this.then(function(value) {
                return handleCallback(value, true);
              }, function(error) {
                return handleCallback(error, false);
              });
            }
          }
        };
        return deferred;
      };

      var ref = function(value) {
        if (value && isFunction(value.then)) return value;
        return {
          then: function(callback) {
            var result = defer();
            nextTick(function() {
              result.resolve(callback(value));
            });
            return result.promise;
          }
        };
      };

      var reject = function(reason) {
        return {
          then: function(callback, errback) {
            var result = defer();
            nextTick(function() {
              try {
                result.resolve((isFunction(errback) ? errback : defaultErrback)(reason));
              } catch(e) {
                result.reject(e);
              }
            });
            return result.promise;
          }
        };
      };

      var when = function(value, callback, errback, progressback) {
        var result = defer(),
            done;

        var wrappedCallback = function(value) {
          try {
            return (isFunction(callback) ? callback : defaultCallback)(value);
          } catch (e) {
            return reject(e);
          }
        };

        var wrappedErrback = function(reason) {
          try {
            return (isFunction(errback) ? errback : defaultErrback)(reason);
          } catch (e) {
            return reject(e);
          }
        };

        var wrappedProgressback = function(progress) {
          try {
            return (isFunction(progressback) ? progressback : defaultCallback)(progress);
          } catch (e) {
          }
        };

        nextTick(function() {
          ref(value).then(function(value) {
            if (done) return;
            done = true;
            result.resolve(ref(value).then(wrappedCallback, wrappedErrback, wrappedProgressback));
          }, function(reason) {
            if (done) return;
            done = true;
            result.resolve(wrappedErrback(reason));
          }, function(progress) {
            if (done) return;
            result.notify(wrappedProgressback(progress));
          });
        });

        return result.promise;
      };

      function defaultCallback(value) {
        return value;
      }

      function defaultErrback(reason) {
        return reject(reason);
      }

      function all(promises) {
        var deferred = defer(),
            counter = 0,
            results = isArray(promises) ? [] : {};

        promises.forEach(function(promise, key) {
          counter++;
          ref(promise).then(function(value) {
            if (results.hasOwnProperty(key)) return;
            results[key] = value;
            if (!(--counter)) deferred.resolve(results);
          }, function(reason) {
            if (results.hasOwnProperty(key)) return;
            deferred.reject(reason);
          });
        });

       if (counter === 0) {
          deferred.resolve(results);
        }
        return deferred.promise;
      }

      return {
        defer: defer,
        reject: reject,
        when: when,
        all: all
      };
    })(function (callback) {
      setTimeout(callback, 0);
    });

    var tpl = function (array, fn, processes) {
        processes = processes || 2;
        var x = new Array(processes);

        var l = Math.round(array.length / processes);

        for (var i = 0; i < processes; i++) {
            x[i] = [];
            for (var j = 0; j < l && array[0] !== undefined; j++) {
                x[i].push(array.pop());
            }
        }

        var txt =
            'addEventListener("message", function (e) { postMessage(' + fn.toString() + '.call(null, e.data)); });';

        var workers = x.map(function (val) {
            var defer = Q.defer();
            var worker = new Worker(global.URL.createObjectURL(new Blob([txt])));
            worker.onmessage = function (e) {
                defer.resolve(e.data);
            };
            setTimeout(function () {
                worker.postMessage(val);
            }, 0);

            return {
                worker: worker,
                promise: defer.promise
            };
        });

        var workersDefered = Q.defer();

        Q.all(workers.map(function (obj) {
            return obj.promise;
        })).then(function (values) {
            workersDefered.resolve(fn(values));
        });

        return workersDefered.promise;
    };

    if (typeof module === 'object' && typeof module.exports === 'object') {
        module.exports = tpl;
    } else if (typeof define === 'function' && define.amd) {
        define('tpl', function () {
            return tpl;
        });
    } else {
        global.tpl = tpl;
    }
})(this);