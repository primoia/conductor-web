import React from 'react';

interface StatusIndicatorProps {
  isConnected: boolean;
  isLoading: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isConnected,
  isLoading,
}) => {
  const getStatusText = () => {
    if (isLoading) return 'Enviando...';
    if (isConnected) return 'Conectado';
    return 'Desconectado';
  };

  const getStatusClass = () => {
    if (isLoading) return 'loading';
    if (isConnected) return 'connected';
    return 'disconnected';
  };

  return (
    <div className="status" id="status">
      <span
        className={`status-indicator ${getStatusClass()}`}
        id="statusIndicator"
      ></span>
      <span id="statusText">{getStatusText()}</span>
    </div>
  );
};