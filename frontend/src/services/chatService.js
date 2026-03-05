"use strict";

import api from "./api";
import { ENDPOINTS } from "../utils/constants";

const ok = (data, status = 200) => ({
  success: true,
  data,
  status,
});

const fail = (error) => ({
  success: false,
  error: error?.message || "Chat request failed",
  status: error?.status,
  code: error?.code,
});

const execute = async (requestFn) => {
  try {
    const response = await requestFn();
    return ok(response.data, response.status);
  } catch (error) {
    return fail(error);
  }
};

export const getChatContacts = () =>
  execute(() =>
    api.get(`${ENDPOINTS.CHAT}/contacts`)
  );

export const getChatMessages = (
  withUserId,
  limit = 100
) =>
  execute(() =>
    api.get(`${ENDPOINTS.CHAT}/messages`, {
      params: {
        with: withUserId,
        limit,
      },
    })
  );

export const sendChatMessage = ({
  to,
  text,
}) =>
  execute(() =>
    api.post(`${ENDPOINTS.CHAT}/messages`, {
      to,
      text,
    })
  );

export const deleteChatThread = (withUserId) =>
  execute(() =>
    api.delete(`${ENDPOINTS.CHAT}/threads/${withUserId}`)
  );
