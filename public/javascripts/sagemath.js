var $ = require('jquery');
var _ = require('underscore');

$(function() {
    // If there are any sage cells on the page
    if ( ($( ".sage" ).length > 0) || ($( ".sageOutput" ).length > 0)) {
	// Creating a kernel incidentally processes sagecells
	exports.createKernel();
    }
});

var setSeed = _.once(function() {
    if ($('main.activity').length > 0) {
	var activityPath = $('main.activity').attr( 'data-path' );
	var currfilebase = activityPath.split('/').slice(-1)[0];
	var code = 'jobname="' + currfilebase + '"' + "\n";
	code = code + "import hashlib\n";
	code = code + "set_random_seed(int(hashlib.sha256(jobname.encode('utf-8')).hexdigest(), 16))\n";
	exports.sage(code);
    }
});

var executeSageSilents = _.once(function() {
    // Execute any sagesilent blocks
    $('script[type="text/sagemath"]').each( function() {
	var code = $(this).text();
	
	// Remove any CDATA
	code = code.replace(/#<!\[CDATA\[\s*((.|\n)*)\s*#\]\]>/m,"$1");
	
	exports.sage(code);
    });
});

exports.createKernel = _.once(function() {
    return new Promise(function(resolve, reject) {
	// There's a race condition here: window.sagecell may not be
	// set quickly enough.  So we wait until window.sagecell is
	// set
	var walkback = 50;
	function sagecellReady() {
	    
	    if ((typeof window.sagecell !== "undefined") &&
		(typeof window.sagecell.kernels !== "undefined")) {
		// Create a sagecell in order to trigger the creation of a kernel
		var arrayChangeHandler = {
		    set: function(target, property, value, receiver) {
			if (property == 0) {
			    if (value != null) {
				window.setTimeout( function() {
				    resolve(value);
				}, 0);
			    }
			}
			target[property] = value;
			return true;
		    }
		};
		window.sagecell.kernels = new Proxy( window.sagecell.kernels, arrayChangeHandler );
		
		var d = document.createElement('div');    
		window.sagecell.makeSagecell({inputLocation: d, linked: true});
		d.children[0].children[1].click();

		// Make sage cells---but make them linked so there's just one kernel.
		window.sagecell.makeSagecell({"inputLocation": ".sage", linked: true});
		window.sagecell.makeSagecell({"inputLocation": ".sageOutput", "hide": ["editor","evalButton"], "autoeval": true, linked: true });
	    }
	    else{
		walkback = walkback * 2;
		window.setTimeout(sagecellReady, walkback);
	    }
	}
	sagecellReady();
    });
});

exports.sage = function(code) {
    setSeed();
    executeSageSilents();
    return new Promise(function(resolve, reject) {
	var output = function(msg) {
	    if (msg.msg_type == "error") {
		reject(msg.content);
	    }
	    if (msg.msg_type == "execute_result") {
		resolve( msg.content.data["text/plain"] );
	    }
	};
	
	var callbacks = {iopub: {"output": output}};

	exports.createKernel().then( function(kernel) {
	    kernel.execute(code, callbacks, {
		"silent": false,
		"user_expressions": {"_sagecell_files": "sys._sage_.new_files()"}
	    });
	});
    });
};

window.sage = function(code) {
    exports.sage(code).then(
	function(result) { console.log(result); },
	function(err) { console.log("err=",err); }
    );
};

