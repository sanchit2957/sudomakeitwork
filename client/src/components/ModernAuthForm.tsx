/*
From Uiverse.io by kyle1dev - https://uiverse.io/kyle1dev/honest-snail-17
MIT License, Copyright (c) kyle1dev (Kyle)
*/

import React, { FormEvent, ReactNode, useState } from "react";
import "./ModernAuthForm.css";

export interface ModernAuthFormProps {
  title?: string;
  mode?: "signin" | "signup";
  onSubmit: (e: FormEvent) => void;
  submitText?: string;
  isSubmitting?: boolean;
  footerText?: string;
  footerActionText?: string;
  onFooterAction?: () => void;
  children?: ReactNode;
  className?: string;
}

export function ModernInputWrapper({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="input-group">
      <div className="input-wrapper">
        {icon && <span className="input-icon flex items-center justify-center">{icon}</span>}
        {children}
      </div>
    </div>
  );
}

export function ModernSubmitButton({
  children,
  isSubmitting,
  disabled,
  className = "",
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  isSubmitting?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      className={`submit-button ${className}`}
      type={type}
      disabled={disabled || isSubmitting}
      onClick={onClick}
    >
      <span className="button-text flex items-center gap-2">{children}</span>
      <div className="button-glow" />
    </button>
  );
}

export function ModernAuthForm({
  title,
  mode = "signup",
  onSubmit,
  submitText,
  isSubmitting = false,
  footerText,
  footerActionText,
  onFooterAction,
  children,
  className = "",
}: ModernAuthFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const defaultTitle = mode === "signup" ? "Sign Up" : "Sign In";
  const defaultSubmitText = mode === "signup" ? "Create Account" : "Sign In";
  const defaultFooterText = mode === "signup" ? "Already have an account?" : "Don't have an account?";
  const defaultFooterAction = mode === "signup" ? "Login" : "Sign Up";

  return (
    <form className={`modern-form ${className}`} onSubmit={onSubmit}>
      <div className="form-title">{title || defaultTitle}</div>

      <div className="form-body">
        {children ? (
          children
        ) : (
          <>
            {mode === "signup" && (
              <div className="input-group">
                <div className="input-wrapper">
                  <svg fill="none" viewBox="0 0 24 24" className="input-icon">
                    <circle
                      strokeWidth="1.5"
                      stroke="currentColor"
                      r="4"
                      cy="8"
                      cx="12"
                    />
                    <path
                      strokeLinecap="round"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      d="M5 20C5 17.2386 8.13401 15 12 15C15.866 15 19 17.2386 19 20"
                    />
                  </svg>
                  <input
                    required
                    placeholder="Username"
                    className="form-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="input-group">
              <div className="input-wrapper">
                <svg fill="none" viewBox="0 0 24 24" className="input-icon">
                  <path
                    strokeWidth="1.5"
                    stroke="currentColor"
                    d="M3 8L10.8906 13.2604C11.5624 13.7083 12.4376 13.7083 13.1094 13.2604L21 8M5 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19Z"
                  />
                </svg>
                <input
                  required
                  placeholder="Email"
                  className="form-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <div className="input-wrapper">
                <svg fill="none" viewBox="0 0 24 24" className="input-icon">
                  <path
                    strokeWidth="1.5"
                    stroke="currentColor"
                    d="M12 10V14M8 6H16C17.1046 6 18 6.89543 18 8V16C18 17.1046 17.1046 18 16 18H8C6.89543 18 6 17.1046 6 16V8C6 6.89543 6.89543 6 8 6Z"
                  />
                </svg>
                <input
                  required
                  placeholder="Password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <svg fill="none" viewBox="0 0 24 24" className="eye-icon">
                    <path
                      strokeWidth="1.5"
                      stroke="currentColor"
                      d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z"
                    />
                    <circle
                      strokeWidth="1.5"
                      stroke="currentColor"
                      r="3"
                      cy="12"
                      cx="12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <ModernSubmitButton isSubmitting={isSubmitting}>
              {submitText || defaultSubmitText}
            </ModernSubmitButton>

            <div className="form-footer">
              <button
                type="button"
                className="login-link"
                onClick={onFooterAction}
              >
                {footerText || defaultFooterText}{" "}
                <span>{footerActionText || defaultFooterAction}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

export default ModernAuthForm;
