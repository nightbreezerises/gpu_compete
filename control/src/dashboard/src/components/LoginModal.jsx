import React from 'react';
import { useAuth } from '../context/AuthContext';

const LoginModal = () => {
  const { showLoginModal, authenticate, password, setPassword } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  if (!showLoginModal) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const result = await authenticate(password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        width: '360px',
        maxWidth: '90%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        {/* Logo区域 */}
        <div style={{
          width: '80px',
          height: '80px',
          marginBottom: '20px',
          boxShadow: '0 8px 24px rgba(44, 138, 248, 0.3)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}>
          <img 
            src={import.meta.env.BASE_URL + 'images/gpu.jpg'}
            alt="GPU" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
        
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          margin: '0 0 8px 0',
          color: '#2c8af8'
        }}>
          GPU 管理器
        </h2>
        
        <p style={{
          fontSize: '13px',
          color: '#6b7280',
          margin: '0 0 30px 0'
        }}>
          登录以访问此站点
        </p>
        
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入访问密钥"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease',
                outline: 'none',
                backgroundColor: '#f9fafb',
                color: '#374151'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#2c8af8';
                e.target.style.backgroundColor = '#fff';
                e.target.style.boxShadow = '0 0 0 3px rgba(44, 138, 248, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb';
                e.target.style.backgroundColor = '#f9fafb';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: '20px',
              padding: '10px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#ef4444',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '44px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600',
              background: loading ? '#cbd5e1' : '#2c8af8',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(44, 138, 248, 0.3)'
            }}
            onMouseOver={(e) => !loading && (e.target.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
          >
            {loading ? '连接中...' : '连接'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
