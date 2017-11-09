// SDK Needs to create video and canvas nodes in the DOM in order to function
// Here we are adding those nodes a predefined div.
var divRoot = $("#affdex_elements")[0];
var detector = new affdex.CameraDetector(divRoot);

var CHECKIN_TIME = 5;
var ATTENTION_THRESHOLD = 20;
var NO_FACE_THRESHOLD = 5;
var EYE_CLOSURE_DURATION_THRESHOLD = 1;
var EYE_CLOSURE_COUNT_THRESHOLD = 2;
var EYE_CLOSURE_THRESHOLD = 90;
var HEAD_ANGLE_THRESHOLD = -20;
var NOTIFICATION_SOUND = new Audio('sound.mp3');

var attention_score = 0;
var head_angle = 0;
var eye_closure_times = 0;
var eye_closure_start = 0;
var eye_closure_bool = false;
var current_time = 0;
var frames = 0;
var reminders_count = 0;
var time_since_last_face = 0;
var face_visible = true;
var notification_sent = false;

//Enable detection of all Expressions, Emotions and Emojis classifiers.
detector.detectAllEmotions();
detector.detectAllExpressions();

//Add a callback to notify when the detector is initialized and ready for running.
detector.addEventListener("onInitializeSuccess", function() {
  log('#logs', "Tracker initialized.");
  //Display canvas instead of video feed because we want to draw the feature points on it
  $("#face_video_canvas").css("display", "block");
  $("#face_video").css("display", "none");
});

function log(node_name, msg) {
  $(node_name).html("<p>" + msg + "</p>");
  setTimeout( function () {
      $(node_name).html("");
  }, 30000)
}

//function executes when Start button is pushed.
function onStart() {
  if (detector && !detector.isRunning) {
    $("#logs").html("");
    detector.start();
  }
  //log('#logs', "Clicked the start button");
}

//function executes when the Stop button is pushed.
function onStop() {
  //log('#logs', "Clicked the stop button");
  if (detector && detector.isRunning) {
    detector.removeEventListener();
    detector.stop();
  }
}

//function executes when the Reset button is pushed.
function onReset() {
  //log('#logs', "Clicked the reset button");
  if (detector && detector.isRunning) {
    detector.reset();
  }
  attention_score = 0;
  eye_closure_times = 0;
  eye_closure_start = 0;
  eye_closure_bool = false;
  current_time = 0;
  frames = 0;
  reminders_count = 0;
  time_since_last_face = 0;
  face_visible = true;
}

//Add a callback to notify when camera access is allowed
detector.addEventListener("onWebcamConnectSuccess", function() {
  log('#logs', "Webcam access allowed");
});

//Add a callback to notify when camera access is denied
detector.addEventListener("onWebcamConnectFailure", function() {
  log('#logs', "Webcam access denied. Please allow webcam access for the tracker to work.");
});

//Add a callback to notify when detector is stopped
detector.addEventListener("onStopSuccess", function() {
  log('#logs', "Tracker stopped.");
});

//Add a callback to receive the results from processing an image.
//The faces object contains the list of the faces detected in an image.
//Faces object contains probabilities for all the different expressions, emotions and appearance metrics
detector.addEventListener("onImageResultsSuccess", function(faces, image,
  timestamp) {
    if (timestamp - time_since_last_face >= NO_FACE_THRESHOLD && face_visible) {
        face_visible = false;
        notification_sent = false;
        send_notification("We could not detect your face for the last " + NO_FACE_THRESHOLD + " seconds");
        log('#logs', "We could not detect your face for the last " + NO_FACE_THRESHOLD + " seconds");
    }

    if (faces.length > 0) {
        if (!face_visible) {
            face_visible = true;
        }
        time_since_last_face = timestamp;
        var delta = timestamp - current_time;
        if (delta >= CHECKIN_TIME) {
            notification_sent = false;
            if (attention_score / frames <= ATTENTION_THRESHOLD && reminders_count < 3) {
                send_notification("You seem a little distracted.");
                log('#logs', "You seem a little distracted.");
                reminders_count += 1;
            } else if (attention_score / frames <= ATTENTION_THRESHOLD && reminders_count === 3) {
                send_notification("Are you sure you don't need a break?");
                log('#logs', "Are you sure you don't need a break?");
                reminders_count = 0;
            }

            if (head_angle / frames <= HEAD_ANGLE_THRESHOLD && reminders_count < 3) {
                send_notification("You seem to have been looking down a lot.");
                log('#logs', "You seem to have been looking down a lot.");
                reminders_count += 1;
            } else if (head_angle / frames <= HEAD_ANGLE_THRESHOLD && reminders_count === 3) {
                send_notification("Are you sure you don't need a break?");
                log('#logs', "Are you sure you don't need a break?");
                reminders_count = 0;
            }

            if (eye_closure_times >= EYE_CLOSURE_COUNT_THRESHOLD) {
                send_notification("You seem sleepy. Are you sure you don't need a break?");
                log('#logs', "You seem sleepy. Are you sure you don't need a break?");
                eye_closure_times = 0;
            }

            frames = 0;
            attention_score = 0;
            head_angle = 0;
            current_time = timestamp;

        } else {
            frames += 1;
            attention_score += faces[0].expressions.attention;
            head_angle += faces[0].measurements.orientation.pitch;

            //eye closure processing
            if (faces[0].expressions.eyeClosure >= EYE_CLOSURE_THRESHOLD && !eye_closure_bool) {
                eye_closure_start = timestamp;
                eye_closure_bool = true;
            }
            if (faces[0].expressions.eyeClosure <= (100 - EYE_CLOSURE_THRESHOLD) && eye_closure_bool) {
                if (timestamp - eye_closure_start >= EYE_CLOSURE_DURATION_THRESHOLD) {
                    eye_closure_times += parseInt((timestamp - eye_closure_start)/EYE_CLOSURE_DURATION_THRESHOLD);
                }
                eye_closure_bool = false;
            }

        }
        drawFeaturePoints(image, faces[0].featurePoints);
    }

});

//Draw the detected facial feature points on the image
function drawFeaturePoints(img, featurePoints) {
  var contxt = $('#face_video_canvas')[0].getContext('2d');
  var hRatio = contxt.canvas.width / img.width;
  var vRatio = contxt.canvas.height / img.height;
  contxt.strokeStyle = "#FFFFFF";
  for (var id in featurePoints) {
    contxt.beginPath();
    contxt.arc(featurePoints[id].x,
      featurePoints[id].y, 2, 0, 2 * Math.PI);
    contxt.stroke();

  }
}

$(document).ready(function () {
    $("#home-start-button").on('click', function() {
        $("#welcome-screen").css("display", "none");
        $("#loader").css("display", "block");
        setTimeout(function () {
            $("#loader").css("display", "none");
            $("#affectiva-div").css("display", "block");
        }, 2500)
    })
});

function send_notification(msg) {
    if (notification_sent === false) {
        NOTIFICATION_SOUND.play();
        setTimeout(function () {
            alert(msg)
        }, 1000);
        notification_sent = true;
    }
}