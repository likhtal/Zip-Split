'use strict';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function onerror(message) {
  console.log(message);
}

async function file2Ui8(file) {
  const arrayBuffer = await readAsArrayBuffer(file);
  return new Uint8Array(arrayBuffer);
}

function readAsDataURL(b) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onloadend = () => {
      resolve(fr.result)
    };
    fr.readAsDataURL(b);
  });
}

// const arrayBuffer = await readAsArrayBuffer(this.files[0]);
function readAsArrayBuffer(f) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onloadend = () => {
      resolve(fr.result)
    };
    fr.readAsArrayBuffer(f);
  });
}

// const tx = await readAsText(this.files[0]);
function readAsText(f) {
  return new Promise((resolve, reject) => {
    var fr = new FileReader();  
    fr.onloadend = () => {
      resolve(fr.result)
    };
    fr.readAsText(f);
  });
}

var eulog = (function () {
    return {
        log: function() {
            var args = Array.prototype.slice.call(arguments);
            console.log.apply(console, args);
        },
        warn: function() {
            var args = Array.prototype.slice.call(arguments);
            console.warn.apply(console, args);
        },
        error: function() {
            var args = Array.prototype.slice.call(arguments);
            console.error.apply(console, args);
        }
    }
}());

function startsWithFactory(sw) {
	return function(s) {
  	return s.startsWith(sw);
  }
}

function hasSwFactory(sw) {
	return function(s) {
  	return s.includes(sw);
  }
}

var jsUtils = (function () {
  return {
    timeStamp: function() {
      // Create a date object with the current time
      let now = new Date();
      
      // Create an array with the current month, day and time
      let date = [ now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()];
      
      // Create an array with the current hour, minute and second
      let time = [ now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds() ];
      let msecs = now.getUTCMilliseconds();
      
      // If month or date are less than 10, add a zero
      for ( let i = 0; i < date.length; i++ ) {
        if ( date[i] < 10 ) {
          date[i] = "0" + date[i];
        }
      }
      
      // If hours, seconds or minutes are less than 10, add a zero
      for (let i = 0; i < time.length; i++ ) {
        if (time[i] < 10 ) {
          time[i] = "0" + time[i];
        }
      }
      
      // Return the formatted string
      return date.join("-") + "T" + time.join(":") + "." + msecs.toFixed(0);   
    },
    
    setCookie: function(name, value, days) {
      var expires = "";
      if (!!days) {
          var date = new Date();
          date.setTime(date.getTime() + (days*24*60*60*1000));
          expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + (value || "")  + expires + ";secure;path=/";
    },
    
    getCookie: function(name) {
      var nameEQ = name + "=";
      var ca = document.cookie.split(';');
      for(var i=0;i < ca.length;i++) {
          var c = ca[i];
          while (c.charAt(0)==' ') c = c.substring(1,c.length);
          if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
      }
      return null;
    },

    eraseCookie: function(name) {   
      document.cookie = name+'=; Max-Age=-99999999;';  
    }, 

    getDictionary: function(s) {
      const sd = s.replace(/&#39;/ig, '"').replace(/True/ig, 'true').replace(/False/ig, 'false');
      return JSON.parse(sd);
    },
  }
}());
