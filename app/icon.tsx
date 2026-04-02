import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(180deg, #ffffff 0%, #eef3f9 100%)',
          color: '#1f6feb',
          fontSize: 196,
          fontWeight: 800,
          letterSpacing: -10,
        }}
      >
        C
      </div>
    ),
    size,
  );
}
