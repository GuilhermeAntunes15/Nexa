"use client";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference
} from "@livekit/components-react";
import "@livekit/components-styles";

export default function LiveCall({ token, serverUrl, video }) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={true}
      video={video}
      className="nexa-livekit-room"
    >
      <VideoConference />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}
