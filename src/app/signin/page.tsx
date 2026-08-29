"use client"

import kkuLogo from "@/public/kku.png";
import { authClient } from "@/lib/auth-client";
import { Card, Button, Input } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const SSONEXT_CALLBACK_COOKIE = "ssonext_callback_path";
const DEMO_ACCOUNTS = [
    { username: "admin", label: "แอดมิน" },
    { username: "procurement", label: "เจ้าหน้าที่พัสดุ" },
    { username: "finance", label: "เจ้าหน้าที่การเงิน" },
    { username: "planning", label: "เจ้าหน้าที่แผน" },
    { username: "staff", label: "บุคลากร" },
];

function normalizeCallbackPath(callbackUrl: string | null) {
    if (!callbackUrl) {
        return "/";
    }

    try {
        const decoded = decodeURIComponent(callbackUrl);

        if (!decoded.startsWith("/") || decoded.startsWith("//")) {
            return "/";
        }

        return decoded;
    } catch {
        return "/";
    }
}

function persistSsonextCallbackPath(callbackPath: string) {
    document.cookie = `${SSONEXT_CALLBACK_COOKIE}=${encodeURIComponent(callbackPath)}; path=/; max-age=900; samesite=lax; secure`;
}

function LoginContent() {
    const [loadingProvider, setLoadingProvider] = useState<"idhub" | null>(null);
    const [credentialLoading, setCredentialLoading] = useState(false);
    const [credentialLoadingUsername, setCredentialLoadingUsername] = useState<string | null>(null);
    const [credentialUsername, setCredentialUsername] = useState("admin");
    const [credentialPassword, setCredentialPassword] = useState("Ismart123!");
    const [credentialError, setCredentialError] = useState<string | null>(null);
    const [providerError, setProviderError] = useState<string | null>(null);
    const isDevelopment = process.env.NODE_ENV === "development";
    const router = useRouter();
    const searchParams = useSearchParams() ?? new URLSearchParams();
    const callbackUrl = normalizeCallbackPath(searchParams.get("callbackUrl"));
    const ssonextLoginUrl = `https://ssonext.kku.ac.th/login?app=019d280f-5754-77e5-bd13-8cb275931243&state=${encodeURIComponent(callbackUrl)}`;

    useEffect(() => {
        persistSsonextCallbackPath(callbackUrl);
    }, [callbackUrl]);

    const startIdHubLogin = async () => {
        setLoadingProvider("idhub");
        setProviderError(null);

        try {
            const result = await authClient.signIn.social({
                provider: "idhub",
                callbackURL: callbackUrl,
            });
            const url = result.data?.url;

            if (result.error || !url) {
                throw new Error(result.error?.message || "ไม่สามารถเชื่อมต่อ IDHub ได้");
            }

            window.location.assign(url);
        } catch (error) {
            setProviderError(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบด้วย IDHub ได้");
        } finally {
            setLoadingProvider(null);
        }
    };

    const startCredentialLogin = async (username = credentialUsername, password = credentialPassword) => {
        if (!username.trim() || !password.trim()) {
            setCredentialError("กรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน");
            return;
        }

        setCredentialLoading(true);
        setCredentialLoadingUsername(username.trim());
        setCredentialError(null);

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await (authClient.signIn as any).username({
                username: username.trim(),
                password,
                callbackURL: callbackUrl,
            });

            if (result.error) {
                setCredentialError(result.error.message || "ไม่สามารถเข้าสู่ระบบได้");
                return;
            }

            router.replace(callbackUrl);
            router.refresh();
        } finally {
            setCredentialLoading(false);
            setCredentialLoadingUsername(null);
        }
    };

    return (
        <div className="signin-page">
            <section className="signin-layout">
                <div className="signin-brand">
                    <Image priority alt="คณะสหวิทยาการ มหาวิทยาลัยขอนแก่น" height={56} src="/Logo-ISKKU-transparent.png" width={244} />
                    <span>ระบบบริหารจัดการคณะสหวิทยาการ</span>
                </div>
                <div className="signin-card-wrap">
                    <Card className="signin-card">
                        <Card.Header className="flex flex-col items-center gap-2 text-center">
                            <Card.Title className="text-2xl">เข้าสู่ระบบ</Card.Title>
                            <Card.Description className="text-sm text-muted">เลือกบัญชีมหาวิทยาลัยเพื่อเข้าสู่ IS KKU Smart Office</Card.Description>
                        </Card.Header>
                        <Card.Content className="signin-content">
                            <p className="signin-section-label">ผู้ให้บริการยืนยันตัวตน</p>
                            <Link
                                href={ssonextLoginUrl}
                                onClick={() => persistSsonextCallbackPath(callbackUrl)}
                                className="signin-provider signin-provider--sso"
                            >
                                <div className="signin-provider__logo">
                                    <Image
                                        src={kkuLogo}
                                        height={44}
                                        alt="KKU Logo"
                                        priority
                                        width={36}
                                    />
                                </div>
                                <span><strong>เข้าสู่ระบบด้วย KKU SSO</strong><small>บัญชีผู้ใช้มหาวิทยาลัยขอนแก่น</small></span>
                            </Link>

                            <Button
                                className="signin-provider signin-provider--idhub"
                                isDisabled={loadingProvider === "idhub"}
                                onPress={startIdHubLogin}
                                variant="outline"
                            >
                                <span className="signin-provider__logo"><Image
                                    src={kkuLogo}
                                    height={42}
                                    alt="IDHub Logo"
                                    priority
                                    width={32}
                                /></span>
                                <span className="text-left"><strong>{loadingProvider === "idhub" ? "กำลังเชื่อมต่อ IDHub..." : "เข้าสู่ระบบด้วย IDHub"}</strong>
                                    <small>ระบบยืนยันตัวตนมหาวิทยาลัย</small>
                                </span>
                            </Button>

                            {providerError && (
                                <p className="signin-error">
                                    {providerError}
                                </p>
                            )}

                            <div className="signin-note">
                                <strong>บัญชีที่รองรับ</strong>
                                <span>@kku.ac.th · @kkumail.com · @satit.kku.ac.th</span>
                                <small>เลือก KKU SSO หรือ IDHub ตามบัญชีที่ได้รับจากมหาวิทยาลัย</small>
                            </div>

                            {isDevelopment && (
                                <div className="signin-dev-panel">
                                    <div className="mb-3">
                                        <h4 className="text-sm font-semibold text-slate-900">Credential Login</h4>
                                        <p className="text-xs text-slate-700">
                                            บัญชีทดสอบ: <span className="font-medium">admin</span>, <span className="font-medium">procurement</span>, <span className="font-medium">finance</span>, <span className="font-medium">planning</span>, <span className="font-medium">staff</span>
                                        </p>
                                        <p className="text-xs text-slate-700">รหัสผ่านเริ่มต้น: <span className="font-medium">Ismart123!</span></p>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <p className="mb-2 text-xs font-medium text-slate-900">เข้าสู่ระบบด้วยบัญชีเดโม</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {DEMO_ACCOUNTS.map((account) => (
                                                    <Button
                                                        key={account.username}
                                                        className="w-full"
                                                        isDisabled={credentialLoading}
                                                        onPress={() => startCredentialLogin(account.username, "Ismart123!")}
                                                        variant="outline"
                                                    >
                                                        {credentialLoadingUsername === account.username ? "กำลังเข้าสู่ระบบ..." : account.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <label className="block text-xs font-medium text-slate-900">
                                            Username
                                            <Input
                                                value={credentialUsername}
                                                onChange={(event) => setCredentialUsername(event.target.value)}
                                                className="mt-1"
                                                placeholder="admin"
                                            />
                                        </label>

                                        <label className="block text-xs font-medium text-slate-900">
                                            Password
                                            <Input
                                                value={credentialPassword}
                                                onChange={(event) => setCredentialPassword(event.target.value)}
                                                className="mt-1"
                                                type="password"
                                                placeholder="Ismart123!"
                                            />
                                        </label>

                                        {credentialError && (
                                            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                                                {credentialError}
                                            </p>
                                        )}

                                        <Button
                                            className="w-full"
                                            isDisabled={credentialLoading || !credentialUsername.trim() || !credentialPassword.trim()}
                                            onPress={() => startCredentialLogin()}
                                        >
                                            {credentialLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบด้วยบัญชีทดสอบ"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card.Content>
                        <Card.Footer className="signin-footer">ระบบสารสนเทศคณะสหวิทยาการ มหาวิทยาลัยขอนแก่น</Card.Footer>
                    </Card>
                </div>
            </section>
        </div>
    )
}

export default function Login() {
    return (
        <Suspense fallback={<div className="min-h-screen" />}>
            <LoginContent />
        </Suspense>
    );
}