export const urlDataToBlobConverter = (urlData: string) => {
	const splittedData = urlData.split(',');
	const byteCharacters = atob(splittedData[1]);
	const mimeString = splittedData[0].split(':')[1].split(';')[0];
	const byteNumbers = new Array(byteCharacters.length);
	for (let i = 0; i < byteCharacters.length; i++) {
		byteNumbers[i] = byteCharacters.charCodeAt(i);
	}
	const byteArray = new Uint8Array(byteNumbers);

	const convertedBlob = new Blob([byteArray], { type: mimeString });

	return convertedBlob;
};
