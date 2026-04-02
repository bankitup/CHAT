import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          color: '#1f6feb',
          fontSize: 88,
          fontWeight: 800,
          borderRadius: 38,
          border: '8px solid #d9e4f2',
        }}
      >
        C
      </div>
    ),
    size,
  );
}
