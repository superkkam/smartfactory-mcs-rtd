import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 내부 workspace 패키지를 Next.js가 직접 트랜스파일하도록 설정
  transpilePackages: ["@workspace/ui", "@workspace/auth", "@workspace/types"],
};

export default nextConfig;
