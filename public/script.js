const socket = io("/");
const localVideo = document.getElementById("localVideo");
const remoteVideos = document.getElementById("remoteVideos"); // 複数のビデオストリームを管理するためのコンテナ

const ROOM_ID = new URLSearchParams(window.location.search).get("id");
if (!ROOM_ID) {
    alert("Room ID is required!");
    throw new Error("Room ID is required!");
}

const peers = {};
const iceCandidatesQueue = {}; // ICE候補の一時保存用

navigator.mediaDevices
    .getUserMedia({
        video: true,
        audio: true,
    })
    .then((stream) => {
        localVideo.srcObject = stream;

        socket.emit("join-room", ROOM_ID);

        socket.on("user-connected", (userId) => {
            connectToNewUser(userId, stream);
        });

        socket.on("user-disconnected", (userId) => {
            if (peers[userId]) peers[userId].close();
            delete peers[userId];
            const remoteVideo = document.getElementById(`video-${userId}`);
            if (remoteVideo) remoteVideo.remove();
        });

        socket.on("offer", (offer, userId) => {
            if (!peers[userId]) {
                const peer = createPeer(userId, stream);
                peer.setRemoteDescription(new RTCSessionDescription(offer))
                    .then(() => peer.createAnswer())
                    .then((answer) => peer.setLocalDescription(answer))
                    .then(() => {
                        socket.emit(
                            "answer",
                            ROOM_ID,
                            peer.localDescription,
                            userId,
                        );
                    })
                    .then(() => {
                        // 保存されているICE候補を追加
                        if (iceCandidatesQueue[userId]) {
                            iceCandidatesQueue[userId].forEach((candidate) =>
                                peer.addIceCandidate(
                                    new RTCIceCandidate(candidate),
                                ),
                            );
                            delete iceCandidatesQueue[userId];
                        }
                    });
            }
        });

        socket.on("answer", (answer, userId) => {
            if (
                peers[userId] &&
                peers[userId].signalingState === "have-local-offer"
            ) {
                peers[userId]
                    .setRemoteDescription(new RTCSessionDescription(answer))
                    .then(() => {
                        // 保存されているICE候補を追加
                        if (iceCandidatesQueue[userId]) {
                            iceCandidatesQueue[userId].forEach((candidate) =>
                                peers[userId].addIceCandidate(
                                    new RTCIceCandidate(candidate),
                                ),
                            );
                            delete iceCandidatesQueue[userId];
                        }
                    });
            }
        });

        socket.on("candidate", (candidate, userId) => {
            if (peers[userId] && peers[userId].remoteDescription) {
                peers[userId].addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                if (!iceCandidatesQueue[userId]) {
                    iceCandidatesQueue[userId] = [];
                }
                iceCandidatesQueue[userId].push(candidate);
            }
        });

        function connectToNewUser(userId, stream) {
            const peer = createPeer(userId, stream);
            peer.createOffer()
                .then((offer) => peer.setLocalDescription(offer))
                .then(() => {
                    socket.emit(
                        "offer",
                        ROOM_ID,
                        peer.localDescription,
                        userId,
                    );
                });
        }

        function createPeer(userId, stream) {
            const peer = new RTCPeerConnection({
                iceServers: [
                    {
                        urls: "stun:stun.l.google.com:19302",
                    },
                ],
            });
            peers[userId] = peer;

            peer.addStream(stream);

            peer.ontrack = (event) => {
                if (!document.getElementById(`video-${userId}`)) {
                    const remoteVideo = document.createElement("video");
                    remoteVideo.id = `video-${userId}`;
                    remoteVideo.srcObject = event.streams[0];
                    remoteVideo.autoplay = true;
                    remoteVideos.appendChild(remoteVideo);
                }
            };

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit("candidate", ROOM_ID, event.candidate, userId);
                }
            };

            return peer;
        }
    })
    .catch((error) => {
        console.error("Error accessing media devices.", error);
    });
