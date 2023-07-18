const userVideo = document.getElementById('userVideo')
const partnerVideo = document.getElementById('partnerVideo')
let peerRef;
const socketRef = io('http://localhost:8000')
let otherUser;
let userStream;
let roomId = prompt('room id')

navigator.mediaDevices.getUserMedia( {
    audio: true, video: true
}).then(stream => {
    userVideo.srcObject = stream;
    userStream = stream;
    socketRef.emit("join room", roomId);

    socketRef.on('other user', userID => {
        callUser(userID);
        otherUser = userID;
    });

    socketRef.on("user joined", userID => {
        otherUser = userID;
    });

    socketRef.on("offer", handleRecieveCall);

    socketRef.on("answer", handleAnswer);

    socketRef.on("ice-candidate", handleNewICECandidateMsg);
});


function callUser(userID) {
    peerRef = createPeer(userID);
    userStream.getTracks().forEach(track => peerRef.addTrack(track, userStream));
}

function createPeer(userID) {
    const peer = new RTCPeerConnection( {
        iceServers: [{
            urls: "stun:relay.backups.cz"
        },
            {
                url: 'turn:turn.anyfirewall.com:443?transport=tcp',
                credential: 'webrtc',
                username: 'webrtc'
            },
        ]
    });

    peer.onicecandidate = handleICECandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

    return peer;
}

function handleNegotiationNeededEvent(userID) {
    peerRef.createOffer().then(offer => {
        return peerRef.setLocalDescription(offer);
    }).then(() => {
        const payload = {
            target: userID,
            caller: socketRef.id,
            sdp: peerRef.localDescription
        };
        socketRef.emit("offer", payload);
    }).catch(e => console.log(e));
}

function handleRecieveCall(incoming) {
    peerRef = createPeer();
    const desc = new RTCSessionDescription(incoming.sdp);
    peerRef.setRemoteDescription(desc).then(() => {
        userStream.getTracks().forEach(track => peerRef.addTrack(track, userStream));
    }).then(() => {
        return peerRef.createAnswer();
    }).then(answer => {
        return peerRef.setLocalDescription(answer);
    }).then(() => {
        const payload = {
            target: incoming.caller,
            caller: socketRef.id,
            sdp: peerRef.localDescription
        }
        socketRef.emit("answer", payload);
    })
}

function handleAnswer(message) {
    const desc = new RTCSessionDescription(message.sdp);
    peerRef.setRemoteDescription(desc).catch(e => console.log(e));
}

function handleICECandidateEvent(e) {
    if (e.candidate) {
        const payload = {
            target: otherUser,
            candidate: e.candidate,
        }
        socketRef.emit("ice-candidate", payload);
    }
}

function handleNewICECandidateMsg(incoming) {
    const candidate = new RTCIceCandidate(incoming);

    peerRef.addIceCandidate(candidate)
    .catch(e => console.log(e));
}

function handleTrackEvent(e) {
    partnerVideo.srcObject = e.streams[0];
};