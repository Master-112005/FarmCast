"use strict";

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
} from "react";

import MainWorkspace from "../components/layout/MainWorkspace";
import DeviceView from "./DeviceView";
import PredictorView from "./PredictorView";
import CommunityView from "./CommunityView";
import ProfileView from "./ProfileView";
import AdminView from "./AdminView";
import ChatPanel from "../components/chat/ChatPanel";
import NotificationPanel from "../components/notifications/NotificationPanel";
import { getChatContacts } from "../services/chatService";

import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";

const toTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date) return 0;
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const Workspace = () => {
  const { user, logout, role } = useAuth();
  const {
    view,
    VIEWS,
    goProfile,
    setView,
  } = useView();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatRecipientId, setChatRecipientId] = useState(null);
  const [chatContacts, setChatContacts] = useState([]);
  const [chatNotifications, setChatNotifications] = useState([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalDevices: 0,
  });

  const chatSeenRef = useRef({
    initialized: false,
    byContact: {},
  });

  const toggleSidebar = () =>
    setSidebarCollapsed((prev) => !prev);

  useEffect(() => {
    if (view === VIEWS.ADMIN && role !== "admin") {
      setView(VIEWS.DEVICE);
    }
  }, [view, role, VIEWS, setView]);

  useEffect(() => {
    chatSeenRef.current = {
      initialized: false,
      byContact: {},
    };
    setChatContacts([]);
    setChatNotifications([]);

    if (!user?.id) {
      return undefined;
    }

    let isMounted = true;

    const pollChatNotifications = async () => {
      if (chatOpen || document.hidden) {
        return;
      }

      const response = await getChatContacts();
      if (!isMounted || !response?.success) {
        return;
      }

      const contacts = Array.isArray(response.data)
        ? response.data
        : [];

      setChatContacts(contacts);

      setChatNotifications((previous) => {
        const tracker = chatSeenRef.current;
        const nextByContact = {
          ...tracker.byContact,
        };

        const additions = [];

        contacts.forEach((contact) => {
          const incomingTime = toTime(
            contact.latestIncomingAt
          );

          if (
            !Object.prototype.hasOwnProperty.call(
              nextByContact,
              contact.id
            )
          ) {
            nextByContact[contact.id] = 0;
          }

          const seenTime = Number(
            nextByContact[contact.id]
          ) || 0;

          if (
            incomingTime > seenTime &&
            contact.latestIncomingAt
          ) {
            nextByContact[contact.id] = incomingTime;

            const notificationId =
              contact.latestIncomingId ||
              `${contact.id}:${contact.latestIncomingAt}`;

            const alreadyPresent = previous.some(
              (item) => item.id === notificationId
            );

            if (!alreadyPresent) {
              additions.push({
                id: notificationId,
                fromUserId: contact.id,
                fromName:
                  contact.name ||
                  contact.email ||
                  "User",
                text:
                  contact.latestIncomingMessage ||
                  "Open chat to view message",
                createdAt:
                  contact.latestIncomingAt ||
                  new Date().toISOString(),
              });
            }
          }
        });

        chatSeenRef.current = {
          initialized: true,
          byContact: nextByContact,
        };

        if (!additions.length) {
          return previous;
        }

        return [...additions, ...previous].slice(
          0,
          40
        );
      });
    };

    pollChatNotifications();
    const intervalId = window.setInterval(
      pollChatNotifications,
      8000
    );

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [user?.id, chatOpen]);

  useEffect(() => {
    if (!chatOpen || !chatRecipientId) {
      return;
    }

    setChatNotifications((previous) =>
      previous.filter(
        (notification) =>
          notification.fromUserId !== chatRecipientId
      )
    );

    const activeContact = chatContacts.find(
      (contact) => contact.id === chatRecipientId
    );
    const incomingTime = toTime(
      activeContact?.latestIncomingAt
    );

    if (incomingTime > 0) {
      const existing =
        chatSeenRef.current.byContact[
          chatRecipientId
        ] || 0;
      if (incomingTime > existing) {
        chatSeenRef.current.byContact[
          chatRecipientId
        ] = incomingTime;
      }
    }
  }, [chatOpen, chatRecipientId, chatContacts]);

  const clearAllNotifications = useCallback(() => {
    setChatNotifications([]);

    const nextByContact = {
      ...chatSeenRef.current.byContact,
    };

    chatContacts.forEach((contact) => {
      const incomingTime = toTime(
        contact.latestIncomingAt
      );
      if (incomingTime > 0) {
        nextByContact[contact.id] = incomingTime;
      }
    });

    chatSeenRef.current = {
      ...chatSeenRef.current,
      byContact: nextByContact,
    };
  }, [chatContacts]);

  const openChatFromNotification = useCallback(
    (notification) => {
      if (!notification?.fromUserId) {
        return;
      }

      setChatRecipientId(notification.fromUserId);
      setChatOpen(true);
      setNotificationsOpen(false);
    },
    []
  );

  const content = useMemo(() => {
    switch (view) {
      case VIEWS.PREDICTOR:
        return <PredictorView />;
      case VIEWS.COMMUNITY:
        return <CommunityView />;
      case VIEWS.PROFILE:
        return <ProfileView />;
      case VIEWS.ADMIN:
        if (role !== "admin") {
          return <DeviceView />;
        }
        return (
          <AdminView
            searchQuery={adminSearchQuery}
            onSearchQueryChange={setAdminSearchQuery}
            totalUsers={adminStats.totalUsers}
            totalDevices={adminStats.totalDevices}
            onAdminChat={(targetUser) => {
              if (!targetUser?.id) return;
              setChatRecipientId(targetUser.id);
              setChatOpen(true);
            }}
            onAdminStatsChange={(stats) => {
              if (!stats) return;
              setAdminStats({
                totalUsers: Number(stats.totalUsers) || 0,
                totalDevices: Number(stats.totalDevices) || 0,
              });
            }}
          />
        );
      case VIEWS.DEVICE:
      default:
        return <DeviceView />;
    }
  }, [
    view,
    VIEWS,
    role,
    adminSearchQuery,
    adminStats.totalUsers,
    adminStats.totalDevices,
  ]);

  return (
    <>
      <MainWorkspace
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={toggleSidebar}
        onLogout={logout}
        onProfile={goProfile}
        onOpenNotifications={() =>
          setNotificationsOpen(true)
        }
        hasNotificationSignal={
          chatNotifications.length > 0
        }
        userName={user?.name || "Farmer"}
        activeView={view}
      >
        {content}
      </MainWorkspace>

      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        role={role}
        recipientId={chatRecipientId}
        onRecipientChange={setChatRecipientId}
      />

      <NotificationPanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={chatNotifications}
        onOpenChatFromNotification={
          openChatFromNotification
        }
        onClearNotifications={clearAllNotifications}
      />
    </>
  );
};

export default Workspace;


