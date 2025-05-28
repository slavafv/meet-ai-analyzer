import React from "react";
import { Button } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

export default function FileUploader({ onFileSelected }) {
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onFileSelected(file, url);
    }
  };
  return (
    <Button
      variant="outlined"
      component="label"
      startIcon={<UploadFileIcon />}
      fullWidth
    >
      Загрузить аудиофайл (mp3, wav, m4a)
      <input type="file" accept="audio/*" hidden onChange={handleChange} />
    </Button>
  );
}
