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
      <input type="file" accept="audio/*" onChange={handleChange} />
    </div>
  );
}
