import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";

import {
  getChatContacts,
  getChatMessages,
  sendChatMessage,
  deleteChatThread,
} from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";

const formatMessageTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ChatPanel = ({
  isOpen,
  onClose,
  recipientId,
  onRecipientChange,
}) => {
  const { user } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] =
    useState(false);
  const [contactsError, setContactsError] =
    useState("");

  const [threadMessages, setThreadMessages] =
    useState([]);
  const [loadingMessages, setLoadingMessages] =
    useState(false);
  const [threadError, setThreadError] =
    useState("");
  const [threadNotice, setThreadNotice] =
    useState("");

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingThread, setDeletingThread] =
    useState(false);

  const currentUserId = user?.id || null;

  const loadContacts = useCallback(async () => {
    if (!isOpen) return;

    setLoadingContacts(true);
    setContactsError("");

    const response = await getChatContacts();

    if (!response?.success) {
      setContactsError(
        response?.error ||
          "Unable to load chat contacts."
      );
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    const list = Array.isArray(response.data)
      ? response.data
      : [];

    setContacts(list);
    setLoadingContacts(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    loadContacts();
  }, [isOpen, loadContacts]);

  const activeRecipientId = useMemo(() => {
    if (
      recipientId &&
      contacts.some(
        (contact) => contact.id === recipientId
      )
    ) {
      return recipientId;
    }

    return contacts[0]?.id || null;
  }, [recipientId, contacts]);

  useEffect(() => {
    if (!isOpen) return;
    if (!activeRecipientId) return;

    if (
      typeof onRecipientChange === "function" &&
      activeRecipientId !== recipientId
    ) {
      onRecipientChange(activeRecipientId);
    }
  }, [
    isOpen,
    activeRecipientId,
    recipientId,
    onRecipientChange,
  ]);

  const activeRecipient = useMemo(
    () =>
      contacts.find(
        (contact) => contact.id === activeRecipientId
      ) || null,
    [contacts, activeRecipientId]
  );

  const loadMessages = useCallback(async () => {
    if (!isOpen) return;
    if (!activeRecipientId) {
      setThreadMessages([]);
      return;
    }

    setLoadingMessages(true);
    setThreadError("");
    setThreadNotice("");

    const response = await getChatMessages(
      activeRecipientId,
      100
    );

    if (!response?.success) {
      setThreadError(
        response?.error ||
          "Unable to load chat messages."
      );
      setThreadMessages([]);
      setLoadingMessages(false);
      return;
    }

    const messages = Array.isArray(
      response.data?.messages
    )
      ? response.data.messages
      : [];

    setThreadMessages(messages);
    setLoadingMessages(false);
  }, [isOpen, activeRecipientId]);

  useEffect(() => {
    if (!isOpen || !activeRecipientId) return;

    loadMessages();
    const intervalId = window.setInterval(
      loadMessages,
      6000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, activeRecipientId, loadMessages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !activeRecipientId || sending) return;

    setSending(true);
    setThreadError("");

    const response = await sendChatMessage({
      to: activeRecipientId,
      text,
    });

    if (!response?.success) {
      setThreadError(
        response?.error ||
          "Unable to send message."
      );
      setSending(false);
      return;
    }

    setDraft("");
    setSending(false);
    loadMessages();
  };

  const handleSelectChange = (event) => {
    const nextId = event.target.value;
    if (typeof onRecipientChange === "function") {
      onRecipientChange(nextId);
    }
  };

  const handleDeleteThread = async () => {
    if (!activeRecipientId || deletingThread) {
      return;
    }

    const targetName =
      activeRecipient?.name ||
      activeRecipient?.email ||
      "this contact";

    const confirmed = window.confirm(
      `Delete all chat messages with ${targetName}?`
    );

    if (!confirmed) return;

    setDeletingThread(true);
    setThreadError("");
    setThreadNotice("");

    const response = await deleteChatThread(
      activeRecipientId
    );

    if (!response?.success) {
      setThreadError(
        response?.error ||
          "Unable to delete chat."
      );
      setDeletingThread(false);
      return;
    }

    setThreadMessages([]);
    setThreadNotice("Chat deleted.");
    setDeletingThread(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fc-modal" role="dialog" aria-modal="true">
      <div className="fc-modal__content fc-chat">
        <header className="fc-chat__header">
          <div>
            <h2 className="fc-chat__title">Chat</h2>
            <p className="fc-chat__subtitle">
              Message any user in FarmCast
            </p>
          </div>
          <div className="fc-chat__header-actions">
            <button
              type="button"
              className="fc-btn fc-btn--danger"
              onClick={handleDeleteThread}
              disabled={!activeRecipientId || deletingThread}
            >
              <span
                className="material-icons"
                aria-hidden="true"
              >
                delete_sweep
              </span>
              {deletingThread
                ? "Deleting..."
                : "Delete chat"}
            </button>

            <button
              type="button"
              className="fc-btn fc-btn--neutral fc-btn--icon"
              onClick={onClose}
              aria-label="Close chat"
            >
              <span className="material-icons" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </header>

        <div className="fc-chat__recipient">
          <label className="fc-label" htmlFor="chat-recipient">
            Recipient
          </label>

          {loadingContacts ? (
            <div className="fc-input__loading">
              <span className="fc-loader" aria-hidden="true" />
              Loading users...
            </div>
          ) : contactsError ? (
            <div className="fc-alert fc-alert--error">
              {contactsError}
            </div>
          ) : contacts.length === 0 ? (
            <div className="fc-alert fc-alert--neutral">
              No users available for chat.
            </div>
          ) : (
            <select
              id="chat-recipient"
              className="fc-select"
              value={activeRecipientId || ""}
              onChange={handleSelectChange}
            >
              {contacts.map((contact) => (
                <option
                  key={contact.id}
                  value={contact.id}
                >
                  {contact.name ||
                    contact.email ||
                    "User"}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="fc-chat__body">
          <div className="fc-chat__messages">
            {loadingMessages ? (
              <div className="fc-loading">
                Loading messages...
              </div>
            ) : threadNotice ? (
              <div className="fc-alert fc-alert--success">
                {threadNotice}
              </div>
            ) : threadError ? (
              <div className="fc-alert fc-alert--error">
                {threadError}
              </div>
            ) : threadMessages.length === 0 ? (
              <div className="fc-chat__empty">
                No messages yet. Start the conversation.
              </div>
            ) : (
              threadMessages.map((message) => {
                const isOutgoing =
                  message.from === currentUserId;

                const senderLabel = isOutgoing
                  ? "You"
                  : activeRecipient?.name ||
                    "Contact";

                return (
                  <div
                    key={message.id}
                    className={`fc-chat__message ${
                      isOutgoing
                        ? "is-outgoing"
                        : "is-incoming"
                    }`}
                  >
                    <p className="fc-chat__text">{message.text}</p>
                    <span className="fc-chat__meta">
                      {senderLabel}
                      {message.createdAt
                        ? `, ${formatMessageTime(
                            message.createdAt
                          )}`
                        : ""}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="fc-chat__composer">
          <textarea
            className="fc-textarea"
            placeholder={
              activeRecipient
                ? `Message ${activeRecipient.name || "recipient"}`
                : "No recipient selected"
            }
            value={draft}
            onChange={(event) =>
              setDraft(event.target.value)
            }
            rows={3}
            disabled={!activeRecipientId || sending}
          />
          <div className="fc-chat__actions">
            <span className="fc-chat__note">
              Direct messages are private
            </span>
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={handleSend}
              disabled={
                !draft.trim() ||
                !activeRecipientId ||
                sending
              }
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

ChatPanel.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  recipientId: PropTypes.string,
  onRecipientChange: PropTypes.func,
};

export default ChatPanel;
