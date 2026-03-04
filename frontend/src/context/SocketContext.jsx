"use strict";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { io } from "socket.io-client";

import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL ||
  "http://localhost:5000";

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);
  const userIdRef = useRef(null);
  const joinedUserIdRef = useRef(null);

  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  useEffect(() => {
    const userId = user?.id || null;

    if (!isAuthenticated || !userId) {
      joinedUserIdRef.current = null;

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setSocket(null);
      return;
    }

    if (!socketRef.current) {
      const client = io(SOCKET_SERVER_URL, {
        path: "/socket.io",
        withCredentials: true,
      });

      client.on("connect", () => {
        const currentUserId = userIdRef.current;
        if (!currentUserId) return;

        client.emit("join:user", currentUserId);
        joinedUserIdRef.current = currentUserId;
      });

      client.on("disconnect", () => {
        joinedUserIdRef.current = null;
      });

      socketRef.current = client;
      setSocket(client);
    }

    const activeSocket = socketRef.current;
    if (
      activeSocket?.connected &&
      joinedUserIdRef.current !== userId
    ) {
      activeSocket.emit("join:user", userId);
      joinedUserIdRef.current = userId;
    }
  }, [isAuthenticated, user?.id]);

  useEffect(
    () => () => {
      if (!socketRef.current) return;

      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
    },
    []
  );

  const value = useMemo(
    () => ({ socket }),
    [socket]
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

SocketProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);

  if (!ctx) {
    throw new Error(
      "useSocket must be used within SocketProvider"
    );
  }

  return ctx;
};

