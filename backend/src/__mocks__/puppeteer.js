module.exports = {
  launch: async () => ({
    newPage: async () => ({
      setContent: async () => {},
      pdf: async () => Buffer.from('%PDF-1.4 Mock PDF Content'),
      close: async () => {},
    }),
    close: async () => {},
  }),
};