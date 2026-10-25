import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { isAllowedOrigin } from "../utils/originAccess.js";

let ioInstance = null;

export const initializeSocket = (httpServer, allowedOrigins = []) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin, allowedOrigins)) {
          return callback(null, true);
        }

        return callback(new Error(`Socket CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    try {
      const rawToken = socket.handshake.auth?.token || socket.handshake.query?.token || "";
      const token = String(rawToken).replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        return next(new Error("Unauthorized: missing token"));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error("Server configuration error"));
      }

      const decoded = jwt.verify(token, secret);
      socket.userId = String(decoded.id || "");
      if (!socket.userId) {
        return next(new Error("Unauthorized: invalid token payload"));
      }
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const roomId = `user:${socket.userId}`;
    socket.join(roomId);
  });

  return ioInstance;
};

export const getSocketIO = () => ioInstance;
