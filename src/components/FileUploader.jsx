import React from "react";

export default function FileUploader({ onFileSelected, id }) {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onFileSelected(file, url);
    }
  };
  
  return (
    <div id={id}>
      <input 
        type="file" 
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.webm,audio/mp3,audio/m4a,audio/aac,audio/wav,audio/flac,audio/ogg,audio/webm" 
        onChange={handleChange} 
      />
    </div>
  );
}
