import { useState, useCallback, useEffect } from "react";
import { apiLogin, apiRegister, apiGetMe } from "../api/client";

export interface AuthUser {
  username: string;
  name: string;
  email: string;
  role: "admin" | "user";
}

const STORAGE_KEY = "videcomp.auth";
const TOKEN_KEY = "videcomp.token";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Dong bo ho so nguoi dung khi co thay doi
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {}
  }, [currentUser]);

  // Kiem tra token con hop le tren server khi khoi dong
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setCurrentUser(null);
      return;
    }
    let cancelled = false;
    apiGetMe()
      .then((user) => {
        if (!cancelled) {
          setCurrentUser(user);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Token da het han hoac khong hop le
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(STORAGE_KEY);
          setCurrentUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string
    ): Promise<{ success: boolean; role?: "admin" | "user"; message?: string }> => {
      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      if (!trimmedUser || !trimmedPass) {
        return {
          success: false,
          message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
        };
      }

      try {
        const res = await apiLogin(trimmedUser, trimmedPass);
        if (res.access_token) {
          localStorage.setItem(TOKEN_KEY, res.access_token);
        }
        setCurrentUser(res.user);
        setIsLoginModalOpen(false);
        return { success: true, role: res.user.role };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || "Tên đăng nhập hoặc mật khẩu không chính xác.",
        };
      }
    },
    []
  );

  const register = useCallback(
    async (data: {
      username: string;
      email: string;
      password: string;
      confirm_password: string;
      full_name?: string;
    }): Promise<{ success: boolean; role?: "admin" | "user"; message?: string }> => {
      try {
        const res = await apiRegister(data);
        if (res.access_token) {
          localStorage.setItem(TOKEN_KEY, res.access_token);
        }
        setCurrentUser(res.user);
        setIsLoginModalOpen(false);
        return { success: true, role: res.user.role };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.",
        };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }, []);

  const isAuthenticated = currentUser !== null;
  const isAdmin = currentUser?.role === "admin";

  return {
    currentUser,
    isAuthenticated,
    isAdmin,
    login,
    register,
    logout,
    isLoginModalOpen,
    openLoginModal: () => setIsLoginModalOpen(true),
    closeLoginModal: () => setIsLoginModalOpen(false),
  };
}
