import React, {
  useEffect,
  useState,
  useCallback,
} from "react";


import UserProfile from "../components/profile/UserProfile";
import EditProfileForm from "../components/profile/EditProfileForm";
import DeviceManager from "../components/device/DeviceManager";
import DeviceFormModal from "../components/device/DeviceFormModal";
import DeviceDeleteModal from "../components/device/DeviceDeleteModal";
import DeviceProvisionWizard from "../components/device/DeviceProvisionWizard";
import Card from "../components/layout/Card";


import {
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
  uploadProfilePicture,
} from "../services/userService";
import {
  getDevices,
  updateDevice,
} from "../services/deviceService";
import {
  runBackendDeleteFlow,
  runSecureDeleteFlow,
} from "../services/deviceProvisioning";


import { useAuth } from "../context/AuthContext";



const ProfileView = () => {
  /* ---------------- AUTH ---------------- */
  const {
    isAuthenticated,
    role,
    logout,
    updateUser,
  } = useAuth();

  /* ---------------- STATE ---------------- */
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] =
    useState(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] =
    useState(false);
  const [uploadError, setUploadError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceModal, setDeviceModal] =
    useState({
      isOpen: false,
      mode: "add",
      deviceId: null,
      device: null,
    });
  const [
    deviceModalSubmitting,
    setDeviceModalSubmitting,
  ] = useState(false);
  const [deviceModalError, setDeviceModalError] =
    useState("");
  const [deleteModal, setDeleteModal] =
    useState({
      isOpen: false,
      deviceId: null,
      device: null,
    });
  const [
    deleteModalSubmitting,
    setDeleteModalSubmitting,
  ] = useState(false);
  const [deleteModalError, setDeleteModalError] =
    useState("");
  const [deleteModalProgress, setDeleteModalProgress] =
    useState("");
  const [deleteModalFlowMode, setDeleteModalFlowMode] =
    useState("cloud");
  const [deletingDeviceId, setDeletingDeviceId] =
    useState(null);
  const [wizardOpen, setWizardOpen] =
    useState(false);

  

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    const [profileRes, devicesRes] =
      await Promise.all([
        getMyProfile(),
        getDevices(),
      ]);

    if (!profileRes.success) {
      setError("Unable to load profile.");
      setLoading(false);
      return;
    }

    if (!devicesRes.success) {
      setError("Unable to load devices.");
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    const list = Array.isArray(devicesRes.data)
      ? devicesRes.data
      : [];
    setDevices(list);
    setSelectedDevice((prev) => {
      if (list.length === 0) return null;
      if (!prev?.id) return list[0];

      const matched = list.find(
        (item) => item.id === prev.id
      );
      return matched || list[0];
    });

    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  

  const handleSaveProfile = async (
    updatedData
  ) => {
    setSaving(true);
    setError("");

    const payload = {
      name: updatedData.name,
      email: updatedData.email,
      phone: updatedData.phone || null,
      address: updatedData.address || null,
      fieldSize:
        updatedData.fieldSize == null
          ? null
          : Number(updatedData.fieldSize),
    };

    const response = await updateMyProfile(
      payload
    );

    if (!response.success) {
      setError("Failed to update profile.");
      setSaving(false);
      return;
    }

    setProfile(response.data);
    updateUser(response.data);
    setEditing(false);
    setSaving(false);
  };

  

  const handleUploadProfileImage = async (
    file
  ) => {
    if (!file) return;

    setUploadError("");
    setUploadingImage(true);

    const response = await uploadProfilePicture(
      file
    );

    if (!response.success) {
      setUploadError(
        response.error ||
          "Failed to upload profile image."
      );
      setUploadingImage(false);
      return;
    }

    setProfile((prev) => ({
      ...prev,
      ...(response.data || {}),
    }));
    updateUser(response.data || {});
    setUploadingImage(false);
  };

  

  const openAddDeviceModal = () => {
    if (role !== "admin" && role !== "user") {
      return setError(
        "You are not authorized to provision devices."
      );
    }

    setError("");
    setWizardOpen(true);
  };

  const openEditDeviceModal = (id, device) => {
    const sourceDevice =
      device ||
      devices.find((entry) => entry.id === id) ||
      null;

    setDeviceModalError("");
    setDeviceModal({
      isOpen: true,
      mode: "edit",
      deviceId: id,
      device: sourceDevice,
    });
  };

  const closeDeviceModal = () => {
    if (deviceModalSubmitting) return;

    setDeviceModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const handleSubmitDeviceModal = async (
    values
  ) => {
    setDeviceModalError("");
    setError("");
    setDeviceModalSubmitting(true);

    try {
      let response;

      if (
        deviceModal.mode === "edit" &&
        deviceModal.deviceId
      ) {
        response = await updateDevice(
          deviceModal.deviceId,
          {
            name: values.name,
            wifiSsid: values.wifiSsid,
            wifiPassword: values.wifiPassword,
          }
        );
      } else {
        throw new Error(
          "Manual add is disabled. Use USB provisioning."
        );
      }

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Unable to save device."
        );
      }

      await loadData();
      setDeviceModal((prev) => ({
        ...prev,
        isOpen: false,
      }));
    } catch (err) {
      const message =
        err?.message ||
        "Unable to save device.";
      setDeviceModalError(message);
      setError(message);
    } finally {
      setDeviceModalSubmitting(false);
    }
  };

  

  const openDeleteDeviceModal = (
    id,
    device
  ) => {
    setDeleteModalError("");
    setDeleteModalProgress("");
    setDeleteModalFlowMode("cloud");
    setDeleteModal({
      isOpen: true,
      deviceId: id,
      device:
        device ||
        devices.find((entry) => entry.id === id) ||
        null,
    });
  };

  const closeDeleteDeviceModal = () => {
    if (deleteModalSubmitting) return;

    setDeleteModalProgress("");
    setDeleteModalFlowMode("cloud");
    setDeleteModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const handleConfirmDeleteDevice = async () => {
    if (!deleteModal.deviceId) return;

    setError("");
    setDeleteModalError("");
    setDeleteModalSubmitting(true);
    setDeleteModalFlowMode("cloud");
    setDeletingDeviceId(deleteModal.deviceId);
    setDeleteModalProgress("pre_delete");

    try {
      await runBackendDeleteFlow({
        deviceId: deleteModal.deviceId,
        onProgress: (step) => {
          setDeleteModalProgress(step);
        },
      });

      if (
        selectedDevice?.id ===
        deleteModal.deviceId
      ) {
        setSelectedDevice(null);
      }

      await loadData();
      setDeleteModalProgress("completed");
      setDeleteModal((prev) => ({
        ...prev,
        isOpen: false,
      }));
    } catch (err) {
      const message =
        err?.message ||
        "Unable to delete device.";
      setDeleteModalError(message);
      setError(message);
    } finally {
      setDeleteModalSubmitting(false);
      setDeletingDeviceId(null);
      setDeleteModalProgress("");
      setDeleteModalFlowMode("cloud");
    }
  };

  const handleConfirmDeleteDeviceViaUsb =
    async () => {
      if (!deleteModal.deviceId) return;

      setError("");
      setDeleteModalError("");
      setDeleteModalSubmitting(true);
      setDeleteModalFlowMode("usb");
      setDeletingDeviceId(deleteModal.deviceId);
      setDeleteModalProgress("request_usb");

      try {
        await runSecureDeleteFlow({
          deviceId: deleteModal.deviceId,
          onProgress: (step) => {
            setDeleteModalProgress(step);
          },
        });

        if (
          selectedDevice?.id ===
          deleteModal.deviceId
        ) {
          setSelectedDevice(null);
        }

        await loadData();
        setDeleteModalProgress("completed");
        setDeleteModal((prev) => ({
          ...prev,
          isOpen: false,
        }));
      } catch (err) {
        const message =
          err?.message ||
          "Unable to delete device.";
        setDeleteModalError(message);
        setError(message);
      } finally {
        setDeleteModalSubmitting(false);
        setDeletingDeviceId(null);
        setDeleteModalProgress("");
        setDeleteModalFlowMode("cloud");
      }
    };

  const closeProvisionWizard = () => {
    setWizardOpen(false);
  };

  const handleProvisioned = async () => {
    await loadData();
  };

  

  const handleAccountAction = (
    actionId
  ) => {
    switch (actionId) {
      case "logout":
        logout();
        break;
      case "deleteAccount":
        (async () => {
          const response = await deleteMyAccount();

          if (!response.success) {
            setError(
              "Unable to delete account. Please try again."
            );
            return;
          }

          logout();
        })();
        break;
      default:
        break;
    }
  };

  

  if (loading) {
    return (
      <div className="fc-loading">
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="fc-alert fc-alert--error">
        {error || "Profile not available"}
      </div>
    );
  }

  

  return (
    <div className="profile-page">
      <div className="profile-page__main">
        {editing ? (
          <Card
            title="Edit Profile"
            subtitle="Update your personal and farm identity details"
          >
            <EditProfileForm
              initialData={profile}
              onSave={handleSaveProfile}
              onUpload={handleUploadProfileImage}
              onCancel={() =>
                setEditing(false)
              }
              isLoading={saving}
              isUploading={uploadingImage}
              uploadError={uploadError}
            />
          </Card>
        ) : (
          <>
            <UserProfile
              {...profile}
              onEdit={() => setEditing(true)}
              onAccountAction={handleAccountAction}
            />
          </>
        )}
      </div>

      <aside className="profile-page__side">
        <Card>
          <DeviceManager
            devices={devices}
            selectedId={selectedDevice?.id}
            deletingDeviceId={deletingDeviceId}
            onSelect={setSelectedDevice}
            currentUserRole={role}
            onAdd={openAddDeviceModal}
            onEdit={openEditDeviceModal}
            onDelete={openDeleteDeviceModal}
            showSelectorBar
            addButtonLabel="Provision via USB"
            addButtonIcon="usb"
            addEmptyButtonLabel="Provision your first device via USB"
          />
        </Card>
      </aside>

      <DeviceFormModal
        isOpen={deviceModal.isOpen}
        mode={deviceModal.mode}
        device={deviceModal.device}
        isSubmitting={deviceModalSubmitting}
        error={deviceModalError}
        onClose={closeDeviceModal}
        onSubmit={handleSubmitDeviceModal}
      />

      <DeviceDeleteModal
        isOpen={deleteModal.isOpen}
        device={deleteModal.device}
        isSubmitting={deleteModalSubmitting}
        progressStep={deleteModalProgress}
        flowMode={deleteModalFlowMode}
        error={deleteModalError}
        onClose={closeDeleteDeviceModal}
        onConfirmCloudDelete={
          handleConfirmDeleteDevice
        }
        onConfirmUsbDelete={
          handleConfirmDeleteDeviceViaUsb
        }
      />

      <DeviceProvisionWizard
        isOpen={wizardOpen}
        onClose={closeProvisionWizard}
        onProvisioned={handleProvisioned}
      />

      {error && (
        <div className="fc-alert fc-alert--error">
          {error}
        </div>
      )}
    </div>
  );
};

export default ProfileView;


