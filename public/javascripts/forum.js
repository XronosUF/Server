define(['angular', 'jquery', 'underscore', 'socketio', "pagedown-converter", "pagedown-sanitizer", 'angular-sanitize'], function(angular, $, _, io, pagedown, sanitizer) {
    var app = angular.module('ximeraApp.forum', ["ngSanitize"]);

    // public domain code to handle relative date display
    $.getRelativeTime = function(diff) {
	var v = Math.floor(diff / 86400); diff -= v * 86400;
	if (v > 0) return (v == 1 ? 'Yesterday' : v + ' days ago');
	v = Math.floor(diff / 3600); diff -= v * 3600;
	if (v > 0) return v + ' hour' + (v > 1 ? 's' : '') + ' ago';
	v = Math.floor(diff / 60); diff -= v * 60;
	if (v > 0) return v + ' minute' + (v > 1 ? 's' : '') + ' ago';
	return 'Just now';
    };

    $.fn.toRelativeTime = function() {
	var t = $(this), x = Math.round(Date.parse(t.text()) / 1000);
	if (x) t.text($.getRelativeTime(Math.round(
	    new Date().getTime() / 1000) - x));
    };
    
    $.toRelativeTime = function(s) { $(s).each(function() { 
	$(this).toRelativeTime(); 
    }); };


    app.factory('ForumService', ['$rootScope', '$http', function ($rootScope, $http) {
	var service = {};

	service.scores = { xudos: 0, xarma: 0 };

	$http.get( '/users/xarma' ).success(function(data){
	    service.scores.xarma = parseInt(data);
	});

	$http.get( '/users/xudos' ).success(function(data){
	    service.scores.xudos = parseInt(data);
	});

	$rootScope.$on('Xarma', function(e, points) {
	    $http.post( '/users/xarma', {points: points} ).success(function(data){
		service.scores.xarma = parseInt(data);
	    });
	});

	$rootScope.$on('Xudos', function(e, points) {
	    $http.post( '/users/xudos', {points: points} ).success(function(data){
		service.scores.xudos = parseInt(data);
	    });
	});

        return service;
    }]);

    app.directive('thread', ['$compile', '$rootScope', function ($compile, $rootScope) {
        return {
            restrict: 'A',
            scope: {
		posts: '=',
		parent: '=',
		forumName: '@'
            },
            templateUrl: '/template/forum/thread',
            replace: true,

	    // This is needed to permit the recursive directive to terminate
	    compile: function(tElement, tAttr) {
		var contents = tElement.contents().remove();
		var compiledContents;
		return function(scope, iElement, iAttr) {
		    if(!compiledContents) {
			compiledContents = $compile(contents);
		    }
		    compiledContents(scope, function(clone, scope) {
			iElement.append(clone); 
		    });
		};
	    }

        };
    }]);

    app.directive('post', ["$http", "$sce", function ($http, $sce) {
        return {
            restrict: 'A',
            scope: {
		post: '=',
		forumName: '@',
            },
            templateUrl: '/template/forum/post',

	    controller: function($scope, $element){
		$scope.$watch('post.content', function (value) {
		    var safeConverter = Markdown.getSanitizingConverter();
		    if (!value)
			$scope.htmlContent = '';
		    else
			$scope.htmlContent = $sce.trustAsHtml(safeConverter.makeHtml(value));
		});
		
		$scope.upvote = function() {
		    $http.post( '/forum/upvote/' + $scope.post._id );
		    $scope.post.upvotes.push( 'myuseridgoeshere' );
		};
	    }
	};}]);

    app.directive('forum', ['$http', function ($http) {
        return {
            restrict: 'A',
            scope: {
		forum: '@',
            },
            templateUrl: '/template/forum/forum',
            transclude: true,

	    controller: function($scope, $element){
	     	$scope.toplevel = [];
		$scope.posts = {};
		
		// posts need to be added in chronological order to recreate threads
		$scope.addPost = function(post) {
		    $scope.posts[post._id] = post;
		    
		    if ('parent' in post) {
			var parent = $scope.posts[post.parent];

			// Missing parent?  Become a top-level post.
			if (!parent) 
			    parent = {};

			if ('replies' in parent) 
			    parent.replies.push( post );
			else
			    parent.replies = [ post ];
		    }
		    else {
			$scope.toplevel.push( post );
		    }
		};
		
		$http.get( '/forum/' + $scope.forum ).success(function(data){
		    _.each( data, $scope.addPost );
		});
	    }

    };}]);

    app.directive('reply', ['$http', function ($http) {
        return {
            restrict: 'A',
            scope: {
		forumName: '@',
		parent: '@',
		replyDone: '&'
            },
            templateUrl: '/template/forum/reply',

	    controller: function($scope, $element){
		$scope.newPost = {};

		$scope.cancel = function() {
		    $scope.replyDone();
		}


		$scope.newPost.post = function() {
		    $scope.$emit( 'Xarma', 1 );

		    $http.post( '/forum/' + $scope.forumName, {content: $scope.newPost.content, parent: $scope.parent} ).success(function(data){
			$scope.replyDone();
			$scope.errorMessage = undefined;
		    }).error(function(data, status, headers, config) {
			$scope.errorMessage = 'Could not post your message.';
		    })
		};
	    }
    };}]);

    ////////////////////////////////////////////////////////////////
    // rerun mathjax when the given attribute changes
    app.directive('mathjaxOnChange', [function() {
	return {
	    link: function($scope, element, attrs) {
		attrs.$observe('mathjaxOnChange', function(val) {
		    MathJax.Hub.Queue(["Typeset", MathJax.Hub, $(element).children()[0]]);
		});
	    }
	};
    }]);

    ////////////////////////////////////////////////////////////////
    // present the user a dialog box and optionally stop propagation of ng-click 
    app.directive('ngConfirmClick', [
	function(){
	    return {
		priority: -100,  
		restrict: 'A',
		link: function(scope, element, attrs){
		    element.bind('click', function(e){
			var message = attrs.ngConfirmClick;
			if(message && !confirm(message)){
			    e.stopImmediatePropagation();
			    e.preventDefault();
			}
		    });
		}
	    }
	}
    ]);


});
