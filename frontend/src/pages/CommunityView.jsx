/**
 * CommunityView.jsx
 * ------------------------------------------------------
 * FarmCast - Community Feed (Instagram-style)
 *
 * Responsibilities:
 * - Display a modern photo feed
 * - Open post composer from "+" action
 * - Allow owners to delete their posts
 */

"use strict";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Card from "../components/layout/Card";
import styles from "./CommunityView.module.css";
import {
  createCommunityPost,
  deleteCommunityPost,
  getCommunityPosts,
} from "../services/communityService";
import {
  getChatContacts,
  getChatMessages,
  sendChatMessage,
  deleteChatThread,
} from "../services/chatService";
import { useAuth } from "../context/AuthContext";

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

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

const getContactInitial = (contact) => {
  const raw = String(
    contact?.name || contact?.email || "U"
  ).trim();
  return raw.charAt(0).toUpperCase() || "U";
};

const getContactShortName = (contact) => {
  const raw = String(
    contact?.name || contact?.email || "User"
  ).trim();

  if (!raw) return "User";
  if (raw.length <= 14) return raw;
  return `${raw.slice(0, 14)}...`;
};

const composeClassNames = (...classNames) =>
  classNames.filter(Boolean).join(" ");

const CommunityView = () => {
  const { user } = useAuth();

  const [posts, setPosts] = useState([]);
  const [postSearchQuery, setPostSearchQuery] =
    useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isComposerOpen, setIsComposerOpen] =
    useState(false);

  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] =
    useState(false);
  const [submitError, setSubmitError] =
    useState("");
  const [submitSuccess, setSubmitSuccess] =
    useState("");
  const [fileInputKey, setFileInputKey] =
    useState(0);
  const [deletingPostId, setDeletingPostId] =
    useState("");

  const [chatContacts, setChatContacts] =
    useState([]);
  const [loadingContacts, setLoadingContacts] =
    useState(false);
  const [contactsError, setContactsError] =
    useState("");
  const [activeRecipientId, setActiveRecipientId] =
    useState("");
  const [chatMessages, setChatMessages] =
    useState([]);
  const [loadingMessages, setLoadingMessages] =
    useState(false);
  const [messagesError, setMessagesError] =
    useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [sendingMessage, setSendingMessage] =
    useState(false);
  const [deletingChatThread, setDeletingChatThread] =
    useState(false);
  const [chatDeleteExpanded, setChatDeleteExpanded] =
    useState(false);
  const [chatNotice, setChatNotice] = useState("");
  const [previewPost, setPreviewPost] = useState(null);
  const [downloadingPreview, setDownloadingPreview] =
    useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");

    const response = await getCommunityPosts(50);

    if (!response?.success) {
      setError(
        response?.error ||
          "Unable to load community posts."
      );
      setPosts([]);
      setLoading(false);
      return;
    }

    const list = Array.isArray(response.data)
      ? response.data
      : [];

    setPosts(list);
    setLoading(false);
  }, []);

  const loadChatContacts = useCallback(async () => {
    setLoadingContacts(true);
    setContactsError("");

    const response = await getChatContacts();

    if (!response?.success) {
      setContactsError(
        response?.error ||
          "Unable to load users."
      );
      setChatContacts([]);
      setLoadingContacts(false);
      return;
    }

    const list = Array.isArray(response.data)
      ? response.data
      : [];

    setChatContacts(list);
    setActiveRecipientId((previous) => {
      if (
        previous &&
        list.some((contact) => contact.id === previous)
      ) {
        return previous;
      }
      return list[0]?.id || "";
    });
    setLoadingContacts(false);
  }, []);

  const loadChatMessages = useCallback(async () => {
    if (!activeRecipientId) {
      setChatMessages([]);
      return;
    }

    setLoadingMessages(true);
    setMessagesError("");
    setChatNotice("");

    const response = await getChatMessages(
      activeRecipientId,
      100
    );

    if (!response?.success) {
      setMessagesError(
        response?.error ||
          "Unable to load messages."
      );
      setChatMessages([]);
      setLoadingMessages(false);
      return;
    }

    const list = Array.isArray(
      response.data?.messages
    )
      ? response.data.messages
      : [];

    setChatMessages(list);
    setLoadingMessages(false);
  }, [activeRecipientId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    loadChatContacts();

    const intervalId = window.setInterval(
      loadChatContacts,
      12000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadChatContacts]);

  useEffect(() => {
    if (!activeRecipientId) {
      setChatMessages([]);
      return;
    }

    loadChatMessages();

    const intervalId = window.setInterval(
      loadChatMessages,
      7000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRecipientId, loadChatMessages]);

  useEffect(() => {
    setChatDeleteExpanded(false);
    setChatNotice("");
  }, [activeRecipientId]);

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (!previewPost) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setPreviewPost(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [previewPost]);

  const resetComposer = () => {
    setCaption("");
    setFile(null);
    setSubmitError("");
    setSubmitSuccess("");
    setSubmitting(false);
    setFileInputKey((prev) => prev + 1);
  };

  const openComposer = () => {
    resetComposer();
    setIsComposerOpen(true);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
  };

  const openImagePreview = (post) => {
    if (!post?.imageUrl) return;
    setPreviewPost(post);
  };

  const closeImagePreview = () => {
    setPreviewPost(null);
    setDownloadingPreview(false);
  };

  const handleDownloadPreview = async () => {
    if (!previewPost?.imageUrl || downloadingPreview) {
      return;
    }

    setDownloadingPreview(true);

    try {
      const response = await fetch(
        previewPost.imageUrl,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("download_failed");
      }

      const blob = await response.blob();
      const blobType =
        typeof blob.type === "string"
          ? blob.type
          : "";
      const extension =
        blobType.split("/")[1] || "jpg";
      const objectUrl =
        window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = `community-post-${
        previewPost.id || Date.now()
      }.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(
        previewPost.imageUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } finally {
      setDownloadingPreview(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setSubmitError("");
    setSubmitSuccess("");
    setSubmitting(true);

    const response = await createCommunityPost({
      caption,
      file,
    });

    if (!response?.success) {
      setSubmitError(
        response?.error ||
          "Unable to publish post."
      );
      setSubmitting(false);
      return;
    }

    const createdPost = response.data;
    setPosts((prev) =>
      [createdPost, ...prev]
        .filter(Boolean)
        .slice(0, 50)
    );

    setCaption("");
    setFile(null);
    setFileInputKey((prev) => prev + 1);
    setSubmitSuccess("Post published.");
    setSubmitting(false);
    window.setTimeout(() => {
      setIsComposerOpen(false);
      setSubmitSuccess("");
    }, 450);
  };

  const handleDeletePost = async (post) => {
    const postId = post?.id;
    if (!postId || deletingPostId) return;

    const confirmed = window.confirm(
      "Delete this post?"
    );
    if (!confirmed) return;

    setDeletingPostId(postId);
    setError("");

    const response = await deleteCommunityPost(
      postId
    );

    if (!response?.success) {
      setError(
        response?.error ||
          "Unable to delete post."
      );
      setDeletingPostId("");
      return;
    }

    setPosts((prev) =>
      prev.filter((item) => item.id !== postId)
    );
    setDeletingPostId("");
  };

  const handleMessagePostAuthor = (post) => {
    const authorId = post?.author?.id;
    if (!authorId || authorId === user?.id) {
      return;
    }

    const authorName =
      post.author?.name || "User";

    setChatContacts((previous) => {
      const exists = previous.some(
        (item) => item.id === authorId
      );
      if (exists) return previous;

      return [
        {
          id: authorId,
          name: authorName,
          email: "",
          role: post.author?.role || "user",
        },
        ...previous,
      ];
    });

    setActiveRecipientId(authorId);
    setMessagesError("");
  };

  const handleSendMessage = async () => {
    const text = chatDraft.trim();
    if (!text || !activeRecipientId || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    setMessagesError("");
    setChatNotice("");

    const response = await sendChatMessage({
      to: activeRecipientId,
      text,
    });

    if (!response?.success) {
      setMessagesError(
        response?.error ||
          "Unable to send message."
      );
      setSendingMessage(false);
      return;
    }

    setChatDraft("");
    setSendingMessage(false);

    const createdMessage = response.data;
    if (createdMessage?.id) {
      setChatMessages((previous) => [
        ...previous,
        createdMessage,
      ]);
      return;
    }

    loadChatMessages();
  };

  const handleDeleteChat = async () => {
    if (!activeRecipientId || deletingChatThread) {
      return;
    }

    const targetName =
      activeRecipient?.name ||
      activeRecipient?.email ||
      "this user";

    const confirmed = window.confirm(
      `Delete chat with ${targetName}?`
    );
    if (!confirmed) return;

    setDeletingChatThread(true);
    setMessagesError("");
    setChatNotice("");

    const response = await deleteChatThread(
      activeRecipientId
    );

    if (!response?.success) {
      setMessagesError(
        response?.error ||
          "Unable to delete chat."
      );
      setDeletingChatThread(false);
      return;
    }

    setChatMessages([]);
    setChatDraft("");
    setChatDeleteExpanded(false);
    setChatNotice("Chat deleted.");
    setDeletingChatThread(false);
  };

  const activeRecipient = chatContacts.find(
    (contact) => contact.id === activeRecipientId
  );

  const normalizedPostSearchQuery = String(
    postSearchQuery || ""
  )
    .trim()
    .toLowerCase();

  const filteredPosts = useMemo(() => {
    if (!normalizedPostSearchQuery) {
      return posts;
    }

    return posts.filter((post) => {
      const authorSearchableText = [
        post?.author?.name,
        post?.author?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return authorSearchableText.includes(
        normalizedPostSearchQuery
      );
    });
  }, [posts, normalizedPostSearchQuery]);

  return (
    <section
      className={styles["community-page"]}
      aria-label="Community page"
    >
      <div className={styles["community-page__feed"]}>
        <Card>
          <div className={styles["community-feed__head"]}>
            <h2 className={styles["community-feed__title"]}>
              Recent Posts
            </h2>
            <div
              className={composeClassNames(
                "admin-view__search",
                styles["community-feed__search"]
              )}
              role="search"
              aria-label="Search community posts by user"
            >
              <span
                className={composeClassNames(
                  "material-icons",
                  "admin-view__search-icon"
                )}
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="search"
                className={composeClassNames(
                  "fc-input",
                  "admin-view__search-input",
                  styles["community-feed__search-input"]
                )}
                placeholder="Search posts by user name or email"
                value={postSearchQuery}
                onChange={(event) =>
                  setPostSearchQuery(event.target.value)
                }
                aria-label="Search posts by user name or email"
              />
            </div>
            <button
              type="button"
              className={styles["community-feed__add"]}
              onClick={openComposer}
              aria-label="Create community post"
              title="Create post"
            >
              <span
                className="material-icons"
                aria-hidden="true"
              >
                add
              </span>
            </button>
          </div>

          {error ? (
            <div className="fc-alert fc-alert--error">
              {error}
            </div>
          ) : null}

          <div className={styles["community-feed__scroll"]}>
            {loading ? (
              <div
                className="fc-loading"
                aria-busy="true"
              >
                Loading posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="fc-empty-state">
                <span
                  className="material-icons"
                  aria-hidden="true"
                >
                  photo_library
                </span>
                <p className="fc-empty">
                  No community posts yet.
                </p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="fc-empty-state">
                <span
                  className="material-icons"
                  aria-hidden="true"
                >
                  search_off
                </span>
                <p className="fc-empty">
                  No posts found for the searched user.
                </p>
              </div>
            ) : (
              <ul className={styles["community-feed"]}>
                {filteredPosts.map((post) => (
                  <li
                    key={post.id}
                    className={styles["community-post"]}
                  >
                    <header className={styles["community-post__head"]}>
                      <div className={styles["community-post__identity"]}>
                        <img
                          src={
                            post.author?.profileImage ||
                            "/profile-placeholder.svg"
                          }
                          alt={`${post.author?.name || "User"} avatar`}
                          className={styles["community-post__avatar"]}
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.src =
                              "/profile-placeholder.svg";
                          }}
                        />
                        <div className={styles["community-post__meta"]}>
                          <span className={styles["community-post__author"]}>
                            {post.author?.name || "User"}
                            {post.author?.id ===
                            user?.id
                              ? " (You)"
                              : ""}
                          </span>
                          <span className={styles["community-post__time"]}>
                            {formatDateTime(
                              post.createdAt
                            )}
                          </span>
                        </div>
                      </div>

                      <div className={styles["community-post__actions"]}>
                        {post.author?.id &&
                        post.author?.id !==
                          user?.id ? (
                          <button
                            type="button"
                            className={styles["community-post__message"]}
                            onClick={() =>
                              handleMessagePostAuthor(
                                post
                              )
                            }
                            aria-label="Message user"
                            title="Message user"
                          >
                            <span
                              className="material-icons"
                              aria-hidden="true"
                            >
                              chat
                            </span>
                          </button>
                        ) : null}

                        {post.author?.id === user?.id ? (
                          <button
                            type="button"
                            className={styles["community-post__delete"]}
                            onClick={() =>
                              handleDeletePost(post)
                            }
                            disabled={
                              deletingPostId ===
                              post.id
                            }
                            aria-label="Delete post"
                            title="Delete post"
                          >
                            <span
                              className="material-icons"
                              aria-hidden="true"
                            >
                              delete
                            </span>
                          </button>
                        ) : null}
                      </div>
                    </header>

                    {post.caption ? (
                      <p className={styles["community-post__caption"]}>
                        {post.caption}
                      </p>
                    ) : null}

                    {post.imageUrl ? (
                      <div className={styles["community-post__image-wrap"]}>
                        <button
                          type="button"
                          className={
                            styles["community-post__image-open"]
                          }
                          onClick={() =>
                            openImagePreview(post)
                          }
                          aria-label="Open full image"
                          title="Open full image"
                        >
                          <img
                            src={post.imageUrl}
                            alt="Community post"
                            className={styles["community-post__image"]}
                            loading="lazy"
                          />
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className={styles["community-page__chat"]}>
        <Card>
          <div className={styles["community-chat__profiles-wrap"]}>
            <div className={styles["community-chat__profiles"]}>
              {loadingContacts ? (
                <div className={styles["community-chat__profiles-empty"]}>
                  Loading users...
                </div>
              ) : chatContacts.length === 0 ? (
                <div className={styles["community-chat__profiles-empty"]}>
                  No users
                </div>
              ) : (
                chatContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    className={composeClassNames(
                      styles["community-chat__profile"],
                      contact.id === activeRecipientId
                        ? styles["is-active"]
                        : ""
                    )}
                    onClick={() =>
                      setActiveRecipientId(
                        contact.id
                      )
                    }
                    title={
                      contact.name ||
                      contact.email ||
                      "User"
                    }
                  >
                    <span className={styles["community-chat__profile-avatar"]}>
                      {getContactInitial(contact)}
                    </span>
                    <span className={styles["community-chat__profile-name"]}>
                      {getContactShortName(
                        contact
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {contactsError ? (
            <div className="fc-alert fc-alert--error">
              {contactsError}
            </div>
          ) : null}

          {messagesError ? (
            <div className="fc-alert fc-alert--error">
              {messagesError}
            </div>
          ) : null}

          {chatNotice ? (
            <div className="fc-alert fc-alert--success">
              {chatNotice}
            </div>
          ) : null}

          <div className={styles["community-chat__display"]}>
            <div
              className={
                styles["community-chat__composer-controls"]
              }
            >
              <div
                className={composeClassNames(
                  styles["community-chat__delete-control"],
                  chatDeleteExpanded
                    ? styles[
                        "community-chat__delete-control--open"
                      ]
                    : ""
                )}
              >
                <button
                  type="button"
                  className={
                    styles["community-chat__delete-action"]
                  }
                  onClick={handleDeleteChat}
                  disabled={
                    !activeRecipientId ||
                    deletingChatThread
                  }
                >
                  <span
                    className="material-icons"
                    aria-hidden="true"
                  >
                    delete_sweep
                  </span>
                  <span>
                    {deletingChatThread
                      ? "Deleting..."
                      : "Delete chat"}
                  </span>
                </button>

                <button
                  type="button"
                  className={
                    styles["community-chat__settings-toggle"]
                  }
                  onClick={() =>
                    setChatDeleteExpanded((previous) =>
                      previous
                        ? false
                        : Boolean(activeRecipientId)
                    )
                  }
                  disabled={
                    !activeRecipientId ||
                    deletingChatThread
                  }
                  aria-label="Open chat settings"
                  aria-expanded={chatDeleteExpanded}
                >
                  <span
                    className="material-icons"
                    aria-hidden="true"
                  >
                    settings
                  </span>
                </button>
              </div>
            </div>

            <div className={styles["community-chat__body"]}>
              {loadingMessages ? (
                <div className="fc-loading">
                  Loading messages...
                </div>
              ) : !activeRecipientId ? (
                <div className="fc-chat__empty">
                  Select a user profile to start chatting.
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="fc-chat__empty">
                  No messages yet.
                </div>
              ) : (
                <ul className={styles["community-chat__messages"]}>
                  {chatMessages.map((message) => {
                    const isOutgoing =
                      message.from === user?.id;

                    return (
                      <li
                        key={message.id}
                        className={composeClassNames(
                          styles["community-chat__message"],
                          isOutgoing
                            ? styles["is-outgoing"]
                            : styles["is-incoming"]
                        )}
                      >
                        <p className={styles["community-chat__text"]}>
                          {message.text}
                        </p>
                        <span className={styles["community-chat__meta"]}>
                          {isOutgoing
                            ? "You"
                            : activeRecipient?.name ||
                              "User"}
                          {message.createdAt
                            ? `, ${formatMessageTime(
                                message.createdAt
                              )}`
                            : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className={styles["community-chat__composer"]}>
            <div className={styles["community-chat__input-shell"]}>
              <textarea
                className={composeClassNames(
                  "fc-textarea",
                  styles["community-chat__input"]
                )}
                placeholder={
                  activeRecipientId
                    ? `Message ${
                        activeRecipient?.name ||
                        "user"
                      }`
                    : "Select a user first"
                }
                value={chatDraft}
                onChange={(event) =>
                  setChatDraft(
                    event.target.value
                  )
                }
                rows={2}
                disabled={
                  !activeRecipientId ||
                  sendingMessage
                }
              />

              <button
                type="button"
                className={styles["community-chat__send"]}
                onClick={handleSendMessage}
                disabled={
                  !activeRecipientId ||
                  !chatDraft.trim() ||
                  sendingMessage
                }
                aria-label="Send message"
                title="Send message"
              >
                <span
                  className="material-icons"
                  aria-hidden="true"
                >
                  send
                </span>
                <span>Send</span>
              </button>
            </div>
          </div>
        </Card>
      </div>

      {previewPost ? (
        <div
          className="fc-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Post image preview"
        >
          <div
            className={composeClassNames(
              "fc-modal__content",
              styles["community-image-modal"]
            )}
          >
            <header className={styles["community-image-modal__head"]}>
              <div className={styles["community-image-modal__meta"]}>
                <p className={styles["community-image-modal__author"]}>
                  {previewPost.author?.name || "User"}
                </p>
                <p className={styles["community-image-modal__time"]}>
                  {formatDateTime(previewPost.createdAt)}
                </p>
              </div>

              <div className={styles["community-image-modal__actions"]}>
                {previewPost.author?.id !== user?.id ? (
                  <button
                    type="button"
                    className={composeClassNames(
                      "fc-btn",
                      "fc-btn--secondary",
                      styles["community-image-modal__download"]
                    )}
                    onClick={handleDownloadPreview}
                    disabled={downloadingPreview}
                  >
                    <span
                      className="material-icons"
                      aria-hidden="true"
                    >
                      download
                    </span>
                    <span>
                      {downloadingPreview
                        ? "Downloading..."
                        : "Download"}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  className="fc-btn fc-btn--neutral fc-btn--icon"
                  onClick={closeImagePreview}
                  aria-label="Close image preview"
                >
                  <span
                    className="material-icons"
                    aria-hidden="true"
                  >
                    close
                  </span>
                </button>
              </div>
            </header>

            <div className={styles["community-image-modal__body"]}>
              <img
                src={previewPost.imageUrl}
                alt={`Post by ${
                  previewPost.author?.name || "user"
                }`}
                className={styles["community-image-modal__image"]}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isComposerOpen ? (
        <div
          className="fc-modal"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={composeClassNames(
              "fc-modal__content",
              styles["community-composer-modal"]
            )}
          >
            <header className={styles["community-composer-modal__head"]}>
              <h3 className={styles["community-composer-modal__title"]}>
                Create Post
              </h3>
              <button
                type="button"
                className="fc-btn fc-btn--neutral fc-btn--icon"
                onClick={closeComposer}
                aria-label="Close create post"
              >
                <span
                  className="material-icons"
                  aria-hidden="true"
                >
                  close
                </span>
              </button>
            </header>

            <form
              className="fc-form"
              onSubmit={handleSubmit}
            >
              <div className="fc-form-section">
                <label
                  className="fc-label"
                  htmlFor="community_caption"
                >
                  Caption
                </label>
                <textarea
                  id="community_caption"
                  className="fc-textarea"
                  placeholder="Write a caption (optional)..."
                  value={caption}
                  maxLength={500}
                  onChange={(event) =>
                    setCaption(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="fc-form-section">
                <label
                  className="fc-label"
                  htmlFor="community_photo"
                >
                  Photo
                </label>
                <input
                  key={fileInputKey}
                  id="community_photo"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="fc-file-input"
                  onChange={(event) =>
                    setFile(
                      event.target.files?.[0] ||
                        null
                    )
                  }
                />
              </div>

              {submitSuccess ? (
                <div className="fc-alert fc-alert--success">
                  {submitSuccess}
                </div>
              ) : null}

              {submitError ? (
                <div className="fc-alert fc-alert--error">
                  {submitError}
                </div>
              ) : null}

              <div className={styles["community-composer-modal__actions"]}>
                <button
                  type="submit"
                  className="fc-btn fc-btn--primary"
                  disabled={submitting}
                >
                  <span
                    className="material-icons"
                    aria-hidden="true"
                  >
                    upload
                  </span>
                  {submitting
                    ? "Posting..."
                    : "Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default CommunityView;
