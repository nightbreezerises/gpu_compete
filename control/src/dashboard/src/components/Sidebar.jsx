import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/gpu')) return 'gpu';
    if (path.includes('/command')) return 'commands';
    if (path.includes('/state')) return 'logs';
    if (path.includes('/rule')) return 'rules';
    if (path.includes('/setting')) return 'settings';
    return 'gpu';
  };
  
  const activeTab = getActiveTab();

  const menuItems = [
    { key: 'gpu', label: 'GPU', path: '/ui/gpu' },
    { key: 'commands', label: '命令', path: '/ui/command' },
    { key: 'logs', label: '状态', path: '/ui/state' },
    { key: 'rules', label: '规则', path: '/ui/rule' },
    { key: 'settings', label: '设置', path: '/ui/setting' },
  ];

  return (
    <div className="sidebar" style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flexShrink: 0,
      width: '160px',
      userSelect: 'none',
      backgroundColor: '#fff'
    }}>
      {/* Logo */}
      <div style={{
        marginTop: '50px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(44, 138, 248, 0.5)'
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

      {/* 菜单项 */}
      <nav className="sidebar-menu" style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        marginTop: '12px'
      }}>
        {menuItems.map(item => (
          <div key={item.key} className="item" style={{ marginTop: '18px' }}>
            <button
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '36px',
                fontSize: '14px',
                borderRadius: '18px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
                background: activeTab === item.key ? 'linear-gradient(135deg, #57befc, #2c8af8)' : 'transparent',
                color: activeTab === item.key ? '#fff' : '#909399',
                boxShadow: activeTab === item.key ? '0 2px 8px rgba(44, 138, 248, 0.5)' : 'none'
              }}
            >
              {item.label}
            </button>
          </div>
        ))}
      </nav>

      {/* 底部版本信息 */}
      <div className="sidebar-version" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: '20px'
      }}>
        <div style={{
          fontSize: '14px',
          color: '#2c8af8',
          textShadow: '0 2px 6px rgba(44, 138, 248, 0.4)'
        }}>
          GPU 管理器
        </div>
        <div style={{
          textAlign: 'center',
          fontSize: '14px',
          margin: '8px 0',
          padding: '0 10px',
          color: '#54759a'
        }}>
          v1.1.0
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
